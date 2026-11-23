-- =====================================================================
--  UPDATE 4  (run after update-3.sql.  Safe to re-run.)
--  Customer app: public offers slider + purchase history in the profile.
-- =====================================================================

-- every offer with its (visible) items, real price and offer price -> offers slider
create or replace function public_offers() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'title', o.title, 'msg', o.msg, 'img', o.img,
           'items', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', i.id, 'name', i.name, 'cat', i.cat, 'price', i.price, 'offer', e.value::numeric)), '[]'::jsonb)
                     from jsonb_each_text(o.sel) e join items i on i.id = e.key
                     where not coalesce(i.hid, false))
         ) order by o.id desc), '[]'::jsonb)
  from offers o
$$;

-- a registered customer's own bills (matched by phone number)
create or replace function my_bills(p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 't', s.t, 'total', s.total, 'pay', s.pay, 'lines', s.lines) order by s.t desc), '[]'::jsonb)
  from (select * from sales
        where norm_phone(ph) = norm_phone(p_phone)
          and exists (select 1 from qr_registrations r where r.phone = norm_phone(p_phone))
        order by t desc limit 30) s
$$;

-- light views for the customer app (items once, stock numbers refreshed often)
create or replace view public_items as
select id, no, name, price, cat, brand, img, ci from items where not coalesce(hid, false);
create or replace view public_stock as
select v.item_id, v.sku, v.size, v.color, v.qty
from variants v join items i on i.id = v.item_id where not coalesce(i.hid, false);
grant select on public_items, public_stock to anon, authenticated;

revoke all on function public_offers(), my_bills(text) from public;
grant execute on function public_offers(), my_bills(text) to anon, authenticated;
