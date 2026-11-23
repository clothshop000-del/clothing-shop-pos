-- =====================================================================
--  UPDATE 2  -  STAFF / DEVICE APPROVAL INSIDE THE APP  (run after update-1.sql)
--
--  * People create their account from the app's "Request access" screen
--    (no need to open the Supabase dashboard to add users).
--  * The FIRST person to request access becomes the Admin automatically.
--  * Everybody else is "pending" and sees NOTHING until an Admin approves them
--    in the app: Settings > Staff & devices.
--  * Admin can approve, remove, delete, and change the role (Admin / Cashier / Stock Keeper).
--  * This is enforced by the database (row level security), not only by the screen.
--  Safe to re-run.
-- =====================================================================

create table if not exists staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  device      text,
  role        text not null default 'C'       check (role   in ('A','C','K')),   -- A=Admin C=Cashier K=Stock keeper
  status      text not null default 'pending' check (status in ('pending','approved','removed')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  last_seen   timestamptz
);
alter table staff enable row level security;

create or replace function is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and status = 'approved')
$$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and status = 'approved' and role = 'A')
$$;
grant execute on function is_approved(), is_admin() to authenticated;

-- the signed-in person asks for access (first ever request = Admin)
create or replace function request_access(p_name text, p_device text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); r staff; first_user boolean;
begin
  if u is null then raise exception 'not signed in'; end if;
  select * into r from staff where user_id = u;
  if found then
    update staff set last_seen = now(), device = coalesce(nullif(left(p_device, 120), ''), device) where user_id = u
    returning * into r;
    return to_jsonb(r);
  end if;
  first_user := not exists (select 1 from staff);
  insert into staff (user_id, email, name, device, role, status, approved_at, last_seen)
  values (u, (select email from auth.users where id = u), left(coalesce(nullif(p_name, ''), 'Staff'), 60), left(p_device, 120),
          case when first_user then 'A' else 'C' end,
          case when first_user then 'approved' else 'pending' end,
          case when first_user then now() end, now())
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function my_staff() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) from staff s where s.user_id = auth.uid()
$$;
revoke all on function request_access(text, text), my_staff() from public, anon;
grant execute on function request_access(text, text), my_staff() to authenticated;

-- staff table: you can see your own row; admins see and manage everyone
drop policy if exists "staff read"   on staff;
drop policy if exists "staff manage" on staff;
create policy "staff read"   on staff for select to authenticated using (user_id = auth.uid() or (select is_admin()));
create policy "staff manage" on staff for all    to authenticated using ((select is_admin())) with check ((select is_admin()));

-- all shop data: ONLY approved staff (a new, unapproved account sees nothing)
do $$
declare t text;
begin
  foreach t in array array['settings','items','variants','label_jobs','sales','refunds',
    'credit_notes','customers','qr_registrations','qr_orders','offers','offer_notes']
  loop
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format('drop policy if exists "approved staff" on %I', t);
    execute format('create policy "approved staff" on %I for all to authenticated using ((select is_approved())) with check ((select is_approved()))', t);
  end loop;
end $$;

do $$ begin
  begin alter publication supabase_realtime add table staff; exception when others then null; end;
end $$;
