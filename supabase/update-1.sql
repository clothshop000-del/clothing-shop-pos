-- =====================================================================
--  UPDATE 1  (run AFTER schema.sql, once.  Safe to re-run.)
--  * QR order workflow: pending -> confirmed(preparing) -> ready -> completed / rejected
--  * Payment choice: cod (cash on delivery) | bank (bank transfer, delivery) | shop (visit shop)
--  * Orders are priced on the server (offer prices respected, stock checked)
--  * Customers can read the status of their own orders
--  * Realtime for ALL tables (other devices refresh automatically)
-- =====================================================================

alter table qr_orders add column if not exists status     text not null default 'pending';
alter table qr_orders add column if not exists pay_method text;
alter table qr_orders add column if not exists address    text;
alter table qr_orders add column if not exists total      numeric not null default 0;
alter table qr_orders add column if not exists sale_id    int;                 -- the bill created when confirmed
alter table qr_orders add column if not exists done_t     timestamptz;         -- when completed / rejected
update qr_orders set status = 'completed' where done and status = 'pending';
create index if not exists qr_orders_phone_idx on qr_orders (phone);

-- menu now also lists out-of-stock items (customers see them greyed out)
create or replace view public_menu as
select i.id as item_id, i.no, i.name, i.price, i.cat, i.brand, i.img, i.ci,
       v.sku, v.size, v.color, v.qty
from items i join variants v on v.item_id = i.id
where not coalesce(i.hid, false);
grant select on public_menu to anon, authenticated;

-- place an order (prices + stock are checked on the server)
drop function if exists place_order(text, text, jsonb);
create or replace function place_order(p_name text, p_phone text, p_lines jsonb, p_pay text, p_addr text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lines jsonb; v_total numeric; v_id bigint;
begin
  if p_pay not in ('cod', 'bank', 'shop') then raise exception 'invalid payment method'; end if;
  if length(norm_phone(p_phone)) < 9 then raise exception 'invalid phone'; end if;
  if p_pay <> 'shop' and length(trim(coalesce(p_addr, ''))) < 5 then raise exception 'delivery address required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 60 then
    raise exception 'invalid order';
  end if;

  select jsonb_agg(jsonb_build_object(
           'sku', v.sku,
           'n', i.name || case when v.size = 'Free' and v.color = '-' then '' else ' ' || v.size || case when v.color = '-' then '' else ' ' || v.color end end,
           'qty', q.qty, 'price', pr.price)),
         sum(q.qty * pr.price)
    into v_lines, v_total
  from jsonb_to_recordset(p_lines) as q(sku text, qty int)
  join variants v on v.sku = q.sku
  join items i on i.id = v.item_id and not coalesce(i.hid, false)
  cross join lateral (
    select least(i.price, coalesce((select min((o.sel ->> i.id)::numeric) from offers o where o.sel ? i.id), i.price)) as price
  ) pr
  where q.qty > 0 and q.qty <= v.qty;

  if v_lines is null or jsonb_array_length(v_lines) <> jsonb_array_length(p_lines) then
    raise exception 'some items are not available in that quantity';
  end if;

  insert into qr_orders (name, phone, lines, pay_method, address, total, status)
  values (left(coalesce(p_name, ''), 80), norm_phone(p_phone), v_lines, p_pay, left(coalesce(p_addr, ''), 300), v_total, 'pending')
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'total', v_total);
end $$;

-- status of a customer's own orders
create or replace function my_orders(p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'status', o.status, 'total', o.total, 'pay', o.pay_method,
           't', o.t, 'lines', o.lines) order by o.t desc), '[]'::jsonb)
  from (select * from qr_orders where phone = norm_phone(p_phone) order by t desc limit 30) o
$$;

revoke all on function place_order(text,text,jsonb,text,text), my_orders(text) from public;
grant execute on function place_order(text,text,jsonb,text,text), my_orders(text) to anon, authenticated;

-- realtime for every table the staff screens use
do $$
declare t text;
begin
  foreach t in array array['settings','items','variants','label_jobs','sales','refunds','credit_notes',
                           'customers','qr_registrations','qr_orders','offers','offer_notes']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null;   -- already added
    end;
  end loop;
end $$;
