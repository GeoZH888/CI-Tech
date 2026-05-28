# Claude Code Prompt — `CI-Tech` (Tech Project Showcase)

> Paste everything below the line into Claude Code (in VS Code), opened at
> `C:\Users\Lun_z\Desktop\CI-Tech`. Self-contained brief.

---

## Project

Build **CI-Tech** — a public **tech project showcase** that displays all my projects (each with a logo, name, description, and external hyperlink to the live site/repo) in a clean grid, plus a **Super Admin panel** where I can log in to **add / edit / delete / reorder** projects and **upload logos**. Think of it as a portfolio + product directory in one.

This is a sibling project to my `travel-in-italia`, `ST-Progress`, `feiyi`, and `design-world` apps — **use the same stack, the flag switcher, and the mascots** so it feels part of the family. Unlike those, this one has **authentication** and **file upload** because of the admin panel.

I work on Windows with PowerShell and deploy to Netlify with `netlify deploy --prod`. **Important:** PowerShell here-strings choke on Chinese characters — write any file containing Chinese text directly with the editor tools or via a Python `pathlib`/`shutil` script, never a PowerShell heredoc.

## Tech stack (use exactly this)

- **React 18 + Vite**, **react-router-dom**, **react-i18next**
- **Supabase** for database, **Supabase Auth** for super-admin login, **Supabase Storage** for logo uploads
- `.env` placeholders `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **react-dnd** or **@dnd-kit/sortable** for drag-and-drop reordering in the admin panel
- **vite-plugin-pwa**
- Deploy: **Netlify**

Everything lives directly under `C:\Users\Lun_z\Desktop\CI-Tech` (don't nest the Vite project in a subfolder).

---

## Core features

### 1. Public showcase (home page)
- Clean, modern **grid of project cards** — each card shows: logo, project name (trilingual), short tagline (trilingual), category tag, and a "Visit →" button that opens the project's external URL in a new tab (`target="_blank" rel="noopener"`).
- Optional category filter chips at the top (e.g. "All / Education / Cultural / Community / Tools").
- Cards displayed in `sort_order` so I can control the order from the admin panel.
- Trilingual UI via the standard flag switcher 🇨🇳 ZH / 🇮🇹 IT / 🇬🇧 EN, default Italian, persisted to `localStorage`.

### 2. Project detail page (optional click-through)
Clicking a card opens a detail page with a longer trilingual description, optional screenshot gallery, tech stack tags, and the external "Visit live site" button.

### 3. Super Admin panel (`/admin`)
Behind Supabase Auth — only users with `role = 'super_admin'` in the `ct_user_profiles` table can access. Non-logged-in or non-admin visitors hitting `/admin` get redirected to `/admin/login`.

The panel lets me:
- **Add a new project**: name (ZH/IT/EN), tagline (ZH/IT/EN), description (ZH/IT/EN), category, external URL, tech-stack tags (comma-separated), **upload a logo** (drag-and-drop or file picker → goes to Supabase Storage `project-logos` bucket → URL saved to the row).
- **Edit** any existing project (same fields, plus replace logo).
- **Delete** a project (with confirmation modal).
- **Reorder** projects via drag-and-drop — updates the `sort_order` column.
- **Toggle visibility** (`is_published` boolean) so I can stage projects before showing them publicly.

### 4. Authentication
- **Login page** at `/admin/login` with email + password (Supabase Auth).
- Use a `ct_user_profiles` table with a `role` column (`super_admin` | `viewer`) — not a hardcoded password. After login, check the profile's role; if not `super_admin`, sign out and show "Access denied."
- Provide a SQL snippet I can run in Supabase to seed my own super-admin account given my email.
- **RLS that actually works on first try** (I've been burned by `is_admin()` returning false). Define the function explicitly:

  ```sql
  create or replace function is_super_admin() returns boolean
  language sql security definer stable as $$
    select exists (
      select 1 from ct_user_profiles
      where id = auth.uid() and role = 'super_admin'
    );
  $$;
  ```

  All write policies on `ct_projects` use `is_super_admin()`. Read policies allow anyone to read `is_published = true` projects.

### 5. Logo upload (Supabase Storage)
- Bucket `project-logos`, public read.
- File names slugified + timestamped to avoid collisions (e.g. `clf-platform-1716808000.png`).
- Accept PNG / JPG / SVG / WebP, max ~2 MB.
- On upload, save the public URL to `ct_projects.logo_url`.
- When a project's logo is replaced, delete the old file from storage.

### 6. Mascot system (shared with sibling apps)
- A `<Mascot>` that switches by language: **巧巧 (female)** in ZH mode, **Claudio (male)** in IT/EN.
- Speech bubbles per page ("Click a card to visit the project," "管理员登录后可以添加项目"), pulled from i18n files.
- Placeholder SVG/PNG avatars for now, structured so I can swap in final art later (comment where).

---

## Suggested Supabase schema (prefix `ct_`)

```sql
ct_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text check (role in ('super_admin','viewer')) default 'viewer',
  created_at timestamptz default now()
)

ct_projects (
  id uuid primary key default gen_random_uuid(),
  name_zh text, name_it text, name_en text,
  tagline_zh text, tagline_it text, tagline_en text,
  description_zh text, description_it text, description_en text,
  category text,                -- 'education','cultural','community','tools','other'
  external_url text not null,   -- the hyperlink
  logo_url text,                -- Supabase Storage public URL
  tech_stack text[],            -- e.g. ARRAY['React','Vite','Supabase']
  screenshots jsonb,            -- array of image URLs
  sort_order int default 0,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

### RLS policies (write these explicitly — do NOT rely on default policies)

```sql
alter table ct_projects enable row level security;
alter table ct_user_profiles enable row level security;

-- public can read published projects
create policy "public read published projects" on ct_projects
  for select using (is_published = true);

-- super admin can read everything
create policy "admin read all projects" on ct_projects
  for select using (is_super_admin());

-- super admin can write
create policy "admin insert projects" on ct_projects
  for insert with check (is_super_admin());
create policy "admin update projects" on ct_projects
  for update using (is_super_admin());
create policy "admin delete projects" on ct_projects
  for delete using (is_super_admin());

-- users can read their own profile
create policy "read own profile" on ct_user_profiles
  for select using (auth.uid() = id);
```

### Storage bucket policies
- `project-logos` bucket: public SELECT; INSERT/UPDATE/DELETE restricted to `is_super_admin()`.

### Seed data (fill all three languages)
Pre-populate `ct_projects` with my actual projects:
- **CLF Platform** — 大卫学中文 Chinese language learning PWA → `https://zhongwen-world.netlify.app`
- **Miaohong / Wenzi-learn** — oracle bone & pinyin learning PWA → `https://miaohong.netlify.app`
- **AMI168** — bilingual medical booking → `https://ami168.online`
- **JCX Events** — Chinese-Italian community event system
- **Florence Lantern Festival 2026** → `https://florence-lantern2026.com`
- **ZANG Training Studio** — LoRA training for ethnic-minority visual art
- **AtelierOS** — luxury fashion design pipeline (中国风)
- **沪深智投** — A-share investment intelligence platform
- **SASA exhibition guide** — Tibetan cultural patterns
- **Travel in Italia**, **ST-Progress**, **Feiyi**, **Design World** — the sibling apps

Leave `logo_url` empty for these (I'll upload logos through the admin panel as the first end-to-end test). Set `sort_order` so the most recent projects come first.

---

## Build order
1. Scaffold Vite + React + router + i18next + Tailwind (or clean CSS); reuse sibling-project conventions.
2. Supabase client (`src/lib/supabase.js`) + i18n + flag switcher.
3. Schema SQL file (to paste into Supabase SQL editor) including `is_super_admin()`, RLS policies, storage bucket policies, and the seed `INSERT`s for my projects.
4. **Public showcase grid** with category filter + project detail page.
5. **Auth: login page + protected `/admin` route** — including the role check that signs out non-admins.
6. **Admin panel:** add / edit / delete projects (full trilingual form), **logo upload** to Supabase Storage with old-file cleanup, drag-and-drop reordering, publish/unpublish toggle.
7. `<Mascot>` with language switching + trilingual bubbles.
8. `vite-plugin-pwa` (manifest, icons, offline shell — public pages cached, admin not).
9. `netlify.toml` with SPA redirect `/* /index.html 200`.

## Working style
- Move in large, complete batches; make sensible defaults and tell me what you assumed rather than asking after every step.
- After scaffolding, give me exact run commands and the SQL to paste, **plus a clear "how to make my account super admin" step** (insert into `ct_user_profiles` with my email's user id).
- Mind the **PowerShell + Chinese characters** caveat for any file with Chinese text.
- **Test the RLS end-to-end before declaring done** — log in as super admin and confirm insert/update/delete actually succeed. The `is_super_admin()` function returning false is the failure mode I keep hitting; the explicit `security definer stable` definition above should prevent it.

Start by scaffolding + Supabase setup + the public showcase grid (read-only), then check in before building auth and the admin panel.
