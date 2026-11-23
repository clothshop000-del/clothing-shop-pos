-- =====================================================================
--  UPDATE 3  (run after update-2.sql.  Safe to re-run.)
--
--  1. DEVICE approval: every browser/device gets its own approval, even when the same
--     email + password is used. A new device is "pending" until an Admin approves it.
--  2. TABLE-BY-TABLE role rules enforced by the database:
--        A = Admin         : everything
--        C = Cashier       : sales, refunds, credit notes, customers, QR orders, labels,
--                            stock (variants) and read items / offers / settings
--        K = Stock keeper  : items, variants, labels, settings   (no sales / customers)
--  3. Sign in with a USERNAME + password (as well as email + password).
-- =====================================================================

-- legacy table from update-2 (only so the migration below can look at it)
create table if not exists staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, device text,
  role text not null default 'C', status text not null default 'pending',
  created_at timestamptz not null default now(), approved_at timestamptz, last_seen timestamptz
);

create table if not exists profiles (            -- optional username for an account
  user_id  uuid primary key references auth.users(id) on delete cascade,
  username text unique
);
alter table profiles enable row level security;

create table if not exists devices (
  user_id     uuid not null references auth.users(id) on delete cascade,
  device_id   text not null,                     -- random id stored in that browser
  email       text,
  name        text,
  username    text,
  label       text,                              -- "Chrome on Windows"
  role        text not null default 'C' check (role   in ('A','C','K')),
  tabs        text[],                            -- pages this device may open (null = role default)
  status      text not null default 'pending' check (status in ('pending','approved','removed')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  last_seen   timestamptz,
  primary key (user_id, device_id)
);
alter table devices enable row level security;

-- which device is calling?  (the app sends the header  x-device-id )
create or replace function req_device() returns text
language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-device-id', '')
$$;

-- role of the calling device (null if the device is not approved)
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from devices
  where user_id = auth.uid() and device_id = req_device() and status = 'approved'
$$;
grant execute on function req_device(), my_role() to authenticated;

-- the signed-in person registers THIS device (first device ever = Admin)
create or replace function request_access(p_name text, p_device_id text, p_label text, p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); d devices; first_dev boolean; uname text := lower(trim(coalesce(p_username, '')));
begin
  if u is null then raise exception 'not signed in'; end if;
  if coalesce(p_device_id, '') = '' then raise exception 'missing device id'; end if;
  if uname <> '' then
    begin
      insert into profiles (user_id, username) values (u, uname)
      on conflict (user_id) do update set username = excluded.username;
    exception when unique_violation then raise exception 'username already taken';
    end;
  end if;
  select * into d from devices where user_id = u and device_id = p_device_id;
  if found then
    update devices set last_seen = now(), label = coalesce(nullif(left(p_label, 120), ''), label)
    where user_id = u and device_id = p_device_id returning * into d;
    return to_jsonb(d);
  end if;
  -- very first device in the system, or the first device of an admin from update-2  => Admin
  first_dev := not exists (select 1 from devices)
            or (exists (select 1 from staff where user_id = u and status = 'approved' and role = 'A')
                and not exists (select 1 from devices where user_id = u));
  insert into devices (user_id, device_id, email, name, username, label, role, status, approved_at, last_seen)
  values (u, p_device_id, (select email from auth.users where id = u), left(coalesce(nullif(p_name, ''), 'Staff'), 60),
          (select username from profiles where user_id = u), left(p_label, 120),
          case when first_dev then 'A' else 'C' end,
          case when first_dev then 'approved' else 'pending' end,
          case when first_dev then now() end, now())
  returning * into d;
  return to_jsonb(d);
end $$;

create or replace function my_device(p_device_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(d) from devices d where d.user_id = auth.uid() and d.device_id = p_device_id
$$;

-- username -> email  (so people can sign in with a username)
create or replace function login_email(p_login text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.email from profiles p join auth.users u on u.id = p.user_id where p.username = lower(trim(p_login))),
    p_login)
$$;

revoke all on function request_access(text,text,text,text), my_device(text) from public, anon;
grant execute on function request_access(text,text,text,text), my_device(text) to authenticated;
revoke all on function login_email(text) from public;
grant execute on function login_email(text) to anon, authenticated;

-- devices table: Admin devices manage everything; nobody else can read it directly
drop policy if exists "devices admin" on devices;
create policy "devices admin" on devices for all to authenticated
  using ((select my_role()) = 'A') with check ((select my_role()) = 'A');
drop policy if exists "profiles none" on profiles;   -- no direct access (functions only)

-- ---------------------------------------------------------------------
--  ROLE RULES, TABLE BY TABLE
-- ---------------------------------------------------------------------
create or replace function mk_policies(tbl text, readers text[], writers text[]) returns void
language plpgsql as $$
begin
  execute format('alter table %I enable row level security', tbl);
  execute format('drop policy if exists "approved staff" on %I', tbl);
  execute format('drop policy if exists "staff full access" on %I', tbl);
  execute format('drop policy if exists "role read" on %I', tbl);
  execute format('drop policy if exists "role write" on %I', tbl);
  execute format('create policy "role read" on %I for select to authenticated using ((select my_role()) = any (%L::text[]))', tbl, readers);
  execute format('create policy "role write" on %I for all to authenticated using ((select my_role()) = any (%L::text[])) with check ((select my_role()) = any (%L::text[]))', tbl, writers, writers);
end $$;

select mk_policies('settings',         '{A,C,K}', '{A,K}');
select mk_policies('items',            '{A,C,K}', '{A,K}');
select mk_policies('variants',         '{A,C,K}', '{A,C,K}');   -- cashier sells => stock changes
select mk_policies('label_jobs',       '{A,C,K}', '{A,C,K}');
select mk_policies('sales',            '{A,C}',   '{A,C}');
select mk_policies('refunds',          '{A,C}',   '{A,C}');
select mk_policies('credit_notes',     '{A,C}',   '{A,C}');
select mk_policies('customers',        '{A,C}',   '{A,C}');
select mk_policies('qr_orders',        '{A,C}',   '{A,C}');
select mk_policies('qr_registrations', '{A,C}',   '{A}');
select mk_policies('offers',           '{A,C}',   '{A}');
select mk_policies('offer_notes',      '{A,C}',   '{A}');

-- a cashier may create / edit only "Sale items" (items that came back through a refund)
drop policy if exists "cashier sale items" on items;
create policy "cashier sale items" on items for all to authenticated
  using ((select my_role()) = 'C' and cat = 'Sale items')
  with check ((select my_role()) = 'C' and cat = 'Sale items');
