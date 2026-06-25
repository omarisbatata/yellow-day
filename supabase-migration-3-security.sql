-- Yellow Day — SECURITY FIX. Run this once in the Supabase SQL Editor.
--
-- Problem this fixes: products/brands/orders/visits were reachable with
-- "using (true)" policies (or no RLS at all), which means the public anon
-- key embedded in the website's JS could read and write ALL of them
-- directly — including every customer's name/phone/address in `orders`,
-- and a "delete all orders" call with zero authentication.
--
-- After this script:
--   - Anyone can still browse products/brands (storefront keeps working).
--   - Anyone can still place an order or have a visit recorded (storefront keeps working).
--   - Only the admin account can read orders, read visit stats, or write
--     products/brands/orders.
--
-- ⚠️ REQUIRED MANUAL STEP AFTER RUNNING THIS — see the bottom of this file.
-- Without it, the admin panel will stop being able to log in at all.

-- ===== 1. Admin check helper =====
-- Treats whoever is authenticated as the one fixed admin email as "admin".
-- Change the email here (and in admin/login.html + js/supabase.js) if you
-- want to use a different address.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'admin@yellowday.local';
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ===== 2. Wipe any existing policies on the affected tables =====
-- Handles whatever policies were created by hand in the dashboard or by
-- earlier migrations, regardless of what they were named.
do $$
declare
    pol record;
begin
    for pol in
        select policyname, tablename from pg_policies
        where schemaname = 'public' and tablename in ('products', 'brands', 'orders', 'visits')
    loop
        execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
    end loop;
end $$;

-- ===== 3. PRODUCTS: public can read, only admin can write =====
alter table products enable row level security;

create policy "products_public_read" on products
    for select using (true);

create policy "products_admin_write" on products
    for all using (public.is_admin()) with check (public.is_admin());

-- ===== 4. BRANDS: public can read, only admin can write =====
alter table brands enable row level security;

create policy "brands_public_read" on brands
    for select using (true);

create policy "brands_admin_write" on brands
    for all using (public.is_admin()) with check (public.is_admin());

-- ===== 5. ORDERS: anyone can place an order, only admin can read/update/delete =====
alter table orders enable row level security;

create policy "orders_public_insert" on orders
    for insert with check (true);

create policy "orders_admin_select" on orders
    for select using (public.is_admin());

create policy "orders_admin_update" on orders
    for update using (public.is_admin());

create policy "orders_admin_delete" on orders
    for delete using (public.is_admin());

-- ===== 6. VISITS: anyone can record a visit, only admin can read stats =====
alter table visits enable row level security;

create policy "visits_public_insert" on visits
    for insert with check (true);

create policy "visits_admin_select" on visits
    for select using (public.is_admin());

-- ===== 7. Safe public RPC: decrement stock during checkout =====
-- Lets a guest reduce a product's stock when they check out, WITHOUT
-- giving them write access to the rest of the product row (name/price/
-- description/image/etc). Negative or zero quantities are ignored so this
-- can't be abused to inflate stock back up.
create or replace function public.decrement_stock(p_product_id bigint, p_qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_qty is null or p_qty <= 0 then
        return;
    end if;

    update products
    set stock_quantity = greatest(0, stock_quantity - p_qty),
        in_stock = (greatest(0, stock_quantity - p_qty) > 0)
    where id = p_product_id;
end;
$$;

revoke all on function public.decrement_stock(bigint, int) from public;
grant execute on function public.decrement_stock(bigint, int) to anon, authenticated;

-- ===== 8. Safe public RPC: look up "my orders" by phone number =====
-- Lets a guest fetch only the orders matching a phone number they provide,
-- instead of the old behavior where the browser downloaded every order in
-- the store (everyone's name/phone/address) and filtered locally.
create or replace function public.get_orders_by_phone(p_phone text)
returns setof public.orders
language sql
security definer
set search_path = public
as $$
    select * from public.orders where customer_phone = p_phone order by created_at desc;
$$;

revoke all on function public.get_orders_by_phone(text) from public;
grant execute on function public.get_orders_by_phone(text) to anon, authenticated;


-- =====================================================================
-- ⚠️ REQUIRED MANUAL STEP — create the real admin login account:
--
--   1. In the Supabase dashboard, go to Authentication → Users → Add user.
--   2. Email:    admin@yellowday.local
--      (must match exactly — it's hardcoded in is_admin() above and in
--      admin/login.html / js/supabase.js)
--   3. Password: choose a strong password. This REPLACES the old hardcoded
--      "2556510" password — that one no longer works after this migration
--      and the code change that ships with it.
--   4. Tick "Auto Confirm User" so it's usable immediately.
--   5. Log into admin/login.html with that password (the email is filled
--      in automatically — there's still just one password field).
-- =====================================================================
