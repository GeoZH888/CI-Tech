-- ============================================================
-- CI-Tech — schema, RLS, and storage policies
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Then run db/seed.sql for the starter projects, and follow the
-- "MAKE MY ACCOUNT SUPER ADMIN" snippet at the bottom of this file.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------

create table if not exists ct_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text check (role in ('super_admin', 'viewer')) default 'viewer',
  created_at timestamptz default now()
);

create table if not exists ct_projects (
  id uuid primary key default gen_random_uuid(),
  name_zh text, name_it text, name_en text,
  tagline_zh text, tagline_it text, tagline_en text,
  description_zh text, description_it text, description_en text,
  category text default 'other'
    check (category in ('education', 'cultural', 'community', 'tools', 'other')),
  external_url text not null,        -- the live-site / repo hyperlink
  logo_url text,                     -- Supabase Storage public URL
  tech_stack text[] default '{}',    -- e.g. ARRAY['React','Vite','Supabase']
  screenshots jsonb default '[]'::jsonb,
  sort_order int default 0,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists ct_projects_sort_idx on ct_projects (sort_order);
create index if not exists ct_projects_published_idx on ct_projects (is_published);

-- keep updated_at fresh on every UPDATE
create or replace function ct_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ct_projects_touch on ct_projects;
create trigger ct_projects_touch
  before update on ct_projects
  for each row execute function ct_touch_updated_at();

-- ----------------------------------------------------------------
-- 2. Auto-create a profile row when a new auth user signs up.
--    New users default to 'viewer'; promote yourself with the
--    snippet at the bottom of this file.
-- ----------------------------------------------------------------
create or replace function ct_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into ct_user_profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ct_on_auth_user_created on auth.users;
create trigger ct_on_auth_user_created
  after insert on auth.users
  for each row execute function ct_handle_new_user();

-- ----------------------------------------------------------------
-- 3. is_super_admin()  — SECURITY DEFINER + STABLE so it reliably
--    reads ct_user_profiles regardless of the caller's RLS context.
--    (This is the function whose "false" result is the usual RLS gotcha.)
-- ----------------------------------------------------------------
create or replace function is_super_admin() returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from ct_user_profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- ----------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------
alter table ct_projects enable row level security;
alter table ct_user_profiles enable row level security;

-- ct_projects --------------------------------------------------
drop policy if exists "public read published projects" on ct_projects;
create policy "public read published projects" on ct_projects
  for select using (is_published = true);

drop policy if exists "admin read all projects" on ct_projects;
create policy "admin read all projects" on ct_projects
  for select using (is_super_admin());

drop policy if exists "admin insert projects" on ct_projects;
create policy "admin insert projects" on ct_projects
  for insert with check (is_super_admin());

drop policy if exists "admin update projects" on ct_projects;
create policy "admin update projects" on ct_projects
  for update using (is_super_admin()) with check (is_super_admin());

drop policy if exists "admin delete projects" on ct_projects;
create policy "admin delete projects" on ct_projects
  for delete using (is_super_admin());

-- ct_user_profiles ---------------------------------------------
drop policy if exists "read own profile" on ct_user_profiles;
create policy "read own profile" on ct_user_profiles
  for select using (auth.uid() = id);

-- super admins can see all profiles (handy for an admin user list later)
drop policy if exists "admin read all profiles" on ct_user_profiles;
create policy "admin read all profiles" on ct_user_profiles
  for select using (is_super_admin());

-- ----------------------------------------------------------------
-- 5. Storage: project-logos bucket (public read, admin-only write)
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-logos', 'project-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "public read project logos" on storage.objects;
create policy "public read project logos" on storage.objects
  for select using (bucket_id = 'project-logos');

drop policy if exists "admin upload project logos" on storage.objects;
create policy "admin upload project logos" on storage.objects
  for insert with check (bucket_id = 'project-logos' and is_super_admin());

drop policy if exists "admin update project logos" on storage.objects;
create policy "admin update project logos" on storage.objects
  for update using (bucket_id = 'project-logos' and is_super_admin())
  with check (bucket_id = 'project-logos' and is_super_admin());

drop policy if exists "admin delete project logos" on storage.objects;
create policy "admin delete project logos" on storage.objects
  for delete using (bucket_id = 'project-logos' and is_super_admin());

-- ================================================================
-- MAKE MY ACCOUNT SUPER ADMIN
-- ----------------------------------------------------------------
-- 1) First create your login: Supabase Dashboard > Authentication >
--    Users > "Add user" (email + password), OR sign up once via the
--    app's /admin/login page. The trigger above gives you a 'viewer'
--    profile automatically.
-- 2) Then run THIS to promote that email to super_admin. It also
--    upserts the profile in case the trigger didn't run:
--
--    insert into ct_user_profiles (id, email, role)
--    select id, email, 'super_admin' from auth.users
--    where email = 'geoffreyzhang.21202@gmail.com'
--    on conflict (id) do update set role = 'super_admin';
--
-- 3) Verify:  select * from ct_user_profiles where role = 'super_admin';
-- ================================================================
