-- Run this in the Supabase SQL Editor (one-time).
-- Adds image storage columns for products and brands.

alter table products add column if not exists image_url text;
alter table brands add column if not exists logo_url text;
