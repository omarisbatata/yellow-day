-- Yellow Day — run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- Adds: brands table + products.brand_id link, visits table for admin analytics,
-- and clears out the old medicine-category seed/test products.

-- ===== BRANDS =====
create table if not exists brands (
    id bigint generated always as identity primary key,
    name text not null,
    name_ar text not null,
    logo_color text not null default 'linear-gradient(135deg, #FFB800, #FFD166)',
    created_at timestamptz not null default now()
);

alter table brands enable row level security;

drop policy if exists "Allow public read brands" on brands;
create policy "Allow public read brands" on brands for select using (true);

drop policy if exists "Allow public write brands" on brands;
create policy "Allow public write brands" on brands for all using (true) with check (true);

alter table products add column if not exists brand_id bigint references brands(id) on delete set null;

-- ===== VISITS (admin-only analytics) =====
create table if not exists visits (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    page text
);

alter table visits enable row level security;

drop policy if exists "Allow public insert visits" on visits;
create policy "Allow public insert visits" on visits for insert with check (true);

drop policy if exists "Allow public read visits" on visits;
create policy "Allow public read visits" on visits for select using (true);

-- ===== REPOSITION CATALOG: vitamins / skincare / supplements only =====
-- Removes old medicine-only test products (antibiotics, painkillers, cold meds, chronic disease, GI, allergy).
-- If you have real products you want to keep, recategorize them in the admin panel BEFORE running this delete.
delete from products
where category in ('مضادات حيوية', 'مسكنات', 'أدوية برد', 'أمراض مزمنة', 'معدة وأمعاء', 'حساسية');

-- ===== SAMPLE BRANDS (edit or delete as needed) =====
insert into brands (name, name_ar, logo_color) values
    ('Nature''s Bounty', 'نيتشرز باونتي', 'linear-gradient(135deg, #4CAF50, #81C784)'),
    ('Centrum', 'سنتروم', 'linear-gradient(135deg, #1E3A5F, #3B5998)'),
    ('Nivea', 'نيفيا', 'linear-gradient(135deg, #4ECDC4, #7EDDD6)'),
    ('Optimum Nutrition', 'أوبتيموم نيوتريشن', 'linear-gradient(135deg, #A855F7, #C084FC)')
on conflict do nothing;
