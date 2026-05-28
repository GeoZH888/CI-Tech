-- ============================================================
-- CI-Tech IP Studio — schema, RLS, storage
--
-- Run AFTER db/schema.sql (and the seed). Idempotent: re-running is safe.
--
-- What this gives you:
--   ct_ip_characters       a library of base/master cartoon characters
--                          (Claudio, 巧巧, etc.) — name, style anchor,
--                          base image URL
--   ct_ip_variants         generated variants of each character
--                          (scene prompt, output image URL, metadata)
--   ct_projects.mascot_variant_id  optional FK so each public project can
--                          point at the variant it wants to use as its
--                          chat-widget avatar
--   storage bucket 'ip-characters' (public read, super-admin write)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------

create table if not exists ct_ip_characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,                  -- 'Claudio', '巧巧', etc.
  description text,                    -- free-text role / personality
  base_prompt text,                    -- style anchor prepended to every variant
                                       -- (e.g. 'middle-aged Italian businessman,
                                       --  cartoon illustration, soft lighting')
  base_image_url text,                 -- canonical reference image (Storage URL)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ct_ip_variants (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references ct_ip_characters(id) on delete cascade,
  scene text,                          -- short label, e.g. 'in a library reading'
  prompt text,                         -- full prompt sent to the model
  image_url text not null,             -- Supabase Storage public URL
  metadata jsonb default '{}'::jsonb,  -- {model, model_version, seed, num_outputs}
  created_at timestamptz default now()
);

create index if not exists ct_ip_variants_character_idx
  on ct_ip_variants (character_id, created_at desc);

-- Touch updated_at on character updates (reuses the existing fn from db/schema.sql).
drop trigger if exists ct_ip_characters_touch on ct_ip_characters;
create trigger ct_ip_characters_touch
  before update on ct_ip_characters
  for each row execute function ct_touch_updated_at();

-- Each public project may optionally point at one variant as its chat avatar.
alter table ct_projects
  add column if not exists mascot_variant_id uuid
  references ct_ip_variants(id) on delete set null;

-- ----------------------------------------------------------------
-- 2. Row Level Security
-- ----------------------------------------------------------------
alter table ct_ip_characters enable row level security;
alter table ct_ip_variants enable row level security;

-- Anyone can read the library — so the public site can render variants
-- attached to projects without an extra request.
drop policy if exists "public read ip characters" on ct_ip_characters;
create policy "public read ip characters" on ct_ip_characters
  for select using (true);

drop policy if exists "public read ip variants" on ct_ip_variants;
create policy "public read ip variants" on ct_ip_variants
  for select using (true);

-- Only super admins can write.
drop policy if exists "admin write ip characters" on ct_ip_characters;
create policy "admin write ip characters" on ct_ip_characters
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists "admin write ip variants" on ct_ip_variants;
create policy "admin write ip variants" on ct_ip_variants
  for all using (is_super_admin()) with check (is_super_admin());

-- ----------------------------------------------------------------
-- 3. Storage: ip-characters bucket
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ip-characters', 'ip-characters', true)
on conflict (id) do update set public = true;

drop policy if exists "public read ip-characters" on storage.objects;
create policy "public read ip-characters" on storage.objects
  for select using (bucket_id = 'ip-characters');

drop policy if exists "admin upload ip-characters" on storage.objects;
create policy "admin upload ip-characters" on storage.objects
  for insert with check (bucket_id = 'ip-characters' and is_super_admin());

drop policy if exists "admin update ip-characters" on storage.objects;
create policy "admin update ip-characters" on storage.objects
  for update using (bucket_id = 'ip-characters' and is_super_admin())
  with check (bucket_id = 'ip-characters' and is_super_admin());

drop policy if exists "admin delete ip-characters" on storage.objects;
create policy "admin delete ip-characters" on storage.objects
  for delete using (bucket_id = 'ip-characters' and is_super_admin());
