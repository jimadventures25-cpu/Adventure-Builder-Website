-- Adventure Builder Hidden Adventure Store (W28)
-- Run once in Supabase SQL Editor before using shop-admin.html.
-- The store is PRIVATE by default. No public product/order policies are created.
--
-- IMPORTANT OWNER SETUP AFTER RUNNING THIS FILE:
-- 1) In Supabase Dashboard > Authentication > Users, copy your user UUID.
-- 2) Run: insert into public.shop_admins(user_id, role) values ('YOUR-USER-UUID', 'owner') on conflict (user_id) do update set role='owner';

create extension if not exists pgcrypto;

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_shop_admin() from public;
grant execute on function public.is_shop_admin() to authenticated;

create table if not exists public.shop_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'Adventure Store',
  public_enabled boolean not null default false,
  checkout_enabled boolean not null default false,
  currency text not null default 'GBP',
  notice text not null default 'Adventure Store is currently being prepared.',
  updated_at timestamptz not null default now()
);
insert into public.shop_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  category_id uuid references public.shop_categories(id) on delete set null,
  sku text unique,
  price_pence integer not null default 0 check (price_pence >= 0),
  compare_at_price_pence integer check (compare_at_price_pence is null or compare_at_price_pence >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  image_path text,
  image_alt text not null default '',
  sizes text[] not null default '{}',
  colours text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_number text not null unique default ('AB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  status text not null default 'draft' check (status in ('draft','pending','paid','packing','shipped','completed','cancelled','refunded')),
  subtotal_pence integer not null default 0 check (subtotal_pence >= 0),
  shipping_pence integer not null default 0 check (shipping_pence >= 0),
  total_pence integer not null default 0 check (total_pence >= 0),
  customer_email text,
  shipping_name text,
  shipping_address jsonb,
  tracking_reference text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.shop_products(id) on delete set null,
  product_name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price_pence integer not null check (unit_price_pence >= 0),
  variant jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.shop_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.shop_cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.shop_products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  variant jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_admins enable row level security;
alter table public.shop_settings enable row level security;
alter table public.shop_categories enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_favourites enable row level security;
alter table public.shop_cart_items enable row level security;

-- Admin-only policies while the store is hidden.
drop policy if exists "Shop admins read admin list" on public.shop_admins;
create policy "Shop admins read admin list" on public.shop_admins for select to authenticated using (public.is_shop_admin());

drop policy if exists "Shop admins manage settings" on public.shop_settings;
create policy "Shop admins manage settings" on public.shop_settings for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

drop policy if exists "Shop admins manage categories" on public.shop_categories;
create policy "Shop admins manage categories" on public.shop_categories for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

drop policy if exists "Shop admins manage products" on public.shop_products;
create policy "Shop admins manage products" on public.shop_products for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

drop policy if exists "Shop admins manage orders" on public.shop_orders;
create policy "Shop admins manage orders" on public.shop_orders for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

drop policy if exists "Shop admins manage order items" on public.shop_order_items;
create policy "Shop admins manage order items" on public.shop_order_items for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

-- No public cart/favourite policies yet. They stay locked until launch stage.

-- Product image bucket: private until launch.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-product-images','shop-product-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Shop admins read product images" on storage.objects;
create policy "Shop admins read product images" on storage.objects for select to authenticated
using (bucket_id='shop-product-images' and public.is_shop_admin());

drop policy if exists "Shop admins upload product images" on storage.objects;
create policy "Shop admins upload product images" on storage.objects for insert to authenticated
with check (bucket_id='shop-product-images' and public.is_shop_admin());

drop policy if exists "Shop admins update product images" on storage.objects;
create policy "Shop admins update product images" on storage.objects for update to authenticated
using (bucket_id='shop-product-images' and public.is_shop_admin())
with check (bucket_id='shop-product-images' and public.is_shop_admin());

drop policy if exists "Shop admins delete product images" on storage.objects;
create policy "Shop admins delete product images" on storage.objects for delete to authenticated
using (bucket_id='shop-product-images' and public.is_shop_admin());

-- Helpful indexes.
create index if not exists shop_products_category_idx on public.shop_products(category_id);
create index if not exists shop_products_status_idx on public.shop_products(status);
create index if not exists shop_products_stock_idx on public.shop_products(stock_quantity);
create index if not exists shop_orders_created_idx on public.shop_orders(created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders(status);

-- Starter categories. Safe to edit/delete later from the admin page.
insert into public.shop_categories(name, slug, description, sort_order) values
('Membership Packs','membership-packs','Adventure Builder Basic and Premium membership packs.',10),
('Clothing','clothing','Adventure Builder clothing and wearable merchandise.',20),
('Stickers & Patches','stickers-patches','Stickers, window decals and embroidered patches.',30),
('Drinkware','drinkware','Mugs, bottles and insulated drinkware.',40),
('Camping Gear','camping-gear','Selected camping equipment and Adventure Builder accessories.',50),
('Hiking Gear','hiking-gear','Selected walking and hiking accessories.',60),
('Vehicle Accessories','vehicle-accessories','Useful accessories for road trips, campervans and motorhomes.',70),
('Maps & Guides','maps-guides','Adventure maps, route guides and printed planners.',80),
('Gift Cards','gift-cards','Adventure Builder gift cards.',90)
on conflict (slug) do nothing;
