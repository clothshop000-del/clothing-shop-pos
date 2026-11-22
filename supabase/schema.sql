-- =====================================================================
--  CLOTHING SHOP POS  -  Supabase schema
--  Run this WHOLE file once in:  Supabase Dashboard > SQL Editor > New query > Run
--  Safe to re-run: it uses "if not exists" / "or replace" everywhere.
-- =====================================================================

-- 1. SHOP SETTINGS (shop name, logo, tax, users & PINs, categories, brands) ---------
create table if not exists settings (
  id         int primary key default 1 check (id = 1),     -- only one row
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. INVENTORY ----------------------------------------------------------------------
create table if not exists items (
  id         text primary key,                 -- app generated id
  no         int  not null,                    -- item number (1001, 1002 ...)
  name       text not null,
  price      numeric not null default 0,
  cost       numeric not null default 0,
  cat        text,                             -- category (Men, Women, Sale items ...)
  brand      text,                             -- brand / sub-category
  img        text,                             -- item photo (data URL)
  ci         jsonb not null default '{}'::jsonb,  -- colour photos {"Red": "data:..."}
  hid        boolean not null default false,   -- hidden in POS / QR menu
  created_at timestamptz not null default now()
);
create index if not exists items_no_idx  on items (no);
create index if not exists items_cat_idx on items (cat);

create table if not exists variants (          -- one row per size + colour
  sku     text primary key,
  item_id text not null references items(id) on delete cascade,
  size    text not null,
  color   text not null default '-',
  bar     text not null unique,                -- EAN-13 barcode
  qty     int  not null default 0
);
create index if not exists variants_item_idx on variants (item_id);

-- 3. BARCODE LABEL QUEUE (which labels are selected + copies) ------------------------
create table if not exists label_jobs (
  sku    text primary key references variants(sku) on delete cascade,
  copies int  not null default 1 check (copies > 0)
);

-- 4. BILLS (SALES) --------------------------------------------------------------------
create table if not exists sales (
  id       int primary key,                    -- bill number
  t        timestamptz not null,               -- last (re-edit) time
  t0       timestamptz,                        -- first issued time (if re-edited)
  re       int not null default 0,             -- how many times re-edited
  lines    jsonb not null,                     -- [{sku,n,vl,qty,price,d}]
  sub      numeric not null default 0,
  bd       numeric not null default 0,         -- bill discount
  tax      numeric not null default 0,
  total    numeric not null,
  pay      text,                               -- Cash | Card | Bank | QR
  cost     numeric not null default 0,
  profit   numeric not null default 0,
  cashier  text,
  ph       text,                               -- customer phone
  cn       text,                               -- customer name
  rv       numeric not null default 0,         -- cash received
  sp       numeric not null default 0,
  due      numeric not null default 0,
  cnu      numeric not null default 0,         -- credit note amount used
  cnc      text,                               -- credit note code used
  rf       boolean not null default false,
  rt       numeric not null default 0,         -- total refunded
  rp       numeric not null default 0          -- refunded profit
);
create index if not exists sales_t_idx  on sales (t desc);
create index if not exists sales_ph_idx on sales (ph);

-- 5. REFUNDS + CREDIT NOTES -----------------------------------------------------------
create table if not exists refunds (
  id      text primary key,                    -- R1001 ...
  sale_id int  not null references sales(id) on delete cascade,
  t       timestamptz not null,
  amt     numeric not null,
  mode    text not null,                       -- Cash | Credit
  dest    text not null default 'Stock',       -- Stock | Sale  (item went to normal stock or Sale items)
  cashier text,
  code    text,                                -- credit note code
  ph      text,
  cn      text,
  lines   jsonb not null,
  nl      jsonb not null default '[]'::jsonb   -- new sale-item SKUs
);
create index if not exists refunds_sale_idx on refunds (sale_id);

create table if not exists credit_notes (
  code  text primary key,                      -- CN1001 ...
  amt   numeric not null,
  ph    text,
  name  text,
  t     timestamptz not null default now(),
  used  boolean not null default false,
  bill  int
);

-- 6. CUSTOMERS ------------------------------------------------------------------------
create table if not exists customers (          -- customers saved by hand
  phone text primary key,
  name  text,
  kind  text not null default 'W'                -- W = WhatsApp, Q = QR app
);
create table if not exists qr_registrations (    -- customers who registered in the QR app
  phone text primary key,
  name  text,
  t     timestamptz not null default now()
);

-- 7. QR ORDERING ----------------------------------------------------------------------
create table if not exists qr_orders (
  id    bigint generated by default as identity primary key,
  name  text,
  phone text,
  lines jsonb not null,                          -- [{sku,n,qty}]
  t     timestamptz not null default now(),
  done  boolean not null default false
);
create index if not exists qr_orders_t_idx on qr_orders (t desc);

-- 8. OFFERS + NOTIFICATIONS -----------------------------------------------------------
create table if not exists offers (
  id    bigint primary key,
  title text not null,
  msg   text not null default '',
  img   text,                                     -- offer image (data URL)
  sel   jsonb not null default '{}'::jsonb        -- {itemId: offerPrice}
);
create table if not exists offer_notes (         -- "this phone should see this offer"
  phone    text not null,
  offer_id bigint not null references offers(id) on delete cascade,
  t        timestamptz not null default now(),
  primary key (phone, offer_id)
);

-- =====================================================================
--  SECURITY (Row Level Security)
--  * Signed-in shop staff (Supabase Auth user) can read/write everything.
--  * Anonymous visitors (QR customers) can NOT touch the tables directly.
--    They only use the views + functions further below.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['settings','items','variants','label_jobs','sales','refunds',
    'credit_notes','customers','qr_registrations','qr_orders','offers','offer_notes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff full access" on %I', t);
    execute format('create policy "staff full access" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- =====================================================================
--  PUBLIC (QR CUSTOMER) ACCESS  -  safe views and functions only
-- =====================================================================
create or replace function norm_phone(p text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(p,''), '\D', '', 'g'), '^94', '0')
$$;

-- what customers can see: visible items that are in stock (no cost price!)
create or replace view public_menu as
select i.id as item_id, i.no, i.name, i.price, i.cat, i.brand, i.img, i.ci,
       v.sku, v.size, v.color, v.qty
from items i join variants v on v.item_id = i.id
where not coalesce(i.hid, false) and v.qty > 0;

-- shop name / logo / offer text for the QR page
create or replace view public_shop as
select data->'shop'->>'name'  as name,
       data->'shop'->>'logo'  as logo,
       data->'shop'->>'offer' as offer,
       data->'shop'->>'cur'   as cur
from settings where id = 1;

-- customer registers in the QR app
create or replace function register_customer(p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(norm_phone(p_phone)) < 9 then raise exception 'invalid phone'; end if;
  insert into qr_registrations (phone, name)
  values (norm_phone(p_phone), left(coalesce(p_name,''), 80))
  on conflict (phone) do update set name = excluded.name;
end $$;

-- customer places an order from the QR menu
create or replace function place_order(p_name text, p_phone text, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 60 then
    raise exception 'invalid order';
  end if;
  insert into qr_orders (name, phone, lines)
  values (left(coalesce(p_name,''), 80), norm_phone(p_phone), p_lines);
end $$;

-- offers meant for this (registered) phone, with real price + offer price
create or replace function my_offers(p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'title', o.title, 'msg', o.msg, 'img', o.img,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                 'name', i.name, 'cat', i.cat, 'price', i.price, 'offer', e.value::numeric)), '[]'::jsonb)
              from jsonb_each_text(o.sel) e join items i on i.id = e.key)
  ) order by n.t desc), '[]'::jsonb)
  from offer_notes n
  join offers o on o.id = n.offer_id
  where n.phone = norm_phone(p_phone)
    and exists (select 1 from qr_registrations r where r.phone = n.phone)
$$;

revoke all on function register_customer(text,text), place_order(text,text,jsonb), my_offers(text) from public;
grant execute on function register_customer(text,text), place_order(text,text,jsonb), my_offers(text) to anon, authenticated;
grant select on public_menu, public_shop to anon, authenticated;

-- =====================================================================
--  REALTIME: staff screen updates instantly when a customer orders
-- =====================================================================
do $$
begin
  begin alter publication supabase_realtime add table qr_orders;        exception when others then null; end;
  begin alter publication supabase_realtime add table qr_registrations; exception when others then null; end;
end $$;
