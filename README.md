# CI-Tech — Project Showcase

A trilingual (🇨🇳 ZH / 🇮🇹 IT / 🇬🇧 EN) public showcase of tech projects, with a
Super Admin panel to add / edit / delete / reorder projects and upload logos.
Sibling to `travel-in-italia`, `ST-Progress`, `feiyi`, and `design-world` — same
stack, flag switcher, and mascots, plus authentication and file upload.

**Stack:** React 18 + Vite · react-router-dom · react-i18next · Supabase
(DB + Auth + Storage) · @dnd-kit (admin reorder) · vite-plugin-pwa · Netlify.

> **Status:** Batch 1 done — scaffold, Supabase wiring, and the **public
> read-only showcase grid + project detail page**. Auth + admin panel come next.

---

## 1. Run it locally

```powershell
# from C:\Users\Lun_z\Desktop\CI-Tech
copy .env.example .env      # then edit .env with your Supabase values
npm install                 # (already done if you just scaffolded)
npm run dev                 # http://localhost:5173
```

Fill `.env`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Until `.env` is filled in, the app loads and shows a friendly
"configure Supabase" message instead of crashing.

## 2. Set up Supabase

In the Supabase **SQL editor**, run in order:

1. **`db/schema.sql`** — tables, the `is_super_admin()` function, RLS policies,
   the `project-logos` storage bucket + its policies, and triggers.
2. **`db/seed.sql`** — your starter projects (trilingual). Run once.

## 3. Make your account a Super Admin

1. Create your login: Supabase Dashboard → **Authentication → Users → Add user**
   (email `geoffreyzhang.21202@gmail.com` + a password). A `viewer` profile is
   created automatically by the `ct_on_auth_user_created` trigger.
2. Promote it to `super_admin` (run in the SQL editor):

   ```sql
   insert into ct_user_profiles (id, email, role)
   select id, email, 'super_admin' from auth.users
   where email = 'geoffreyzhang.21202@gmail.com'
   on conflict (id) do update set role = 'super_admin';
   ```

3. Verify: `select * from ct_user_profiles where role = 'super_admin';`

(The login page and admin panel arrive in batch 2; the SQL/role plumbing is
already in place so this step works now.)

## 3a. One-time data bootstrap (logos + extra projects)

`scripts/bootstrap-data.mjs` is a small node script that uploads the three
real logo files in `icons and images/` to the `project-logos` bucket and
adds the **Ciao News**, **LINGUA — Learn Italian**, and **Patente** projects
(plus attaches a logo to the existing **Feiyi** row). It needs your Supabase
**service-role** key — find it in Supabase Dashboard → Project Settings →
API → "service_role" (reveal). **Treat that key as a secret; never commit it.**

```powershell
# PowerShell
$env:SUPABASE_SERVICE_ROLE_KEY="<paste-service-role-key>"
node scripts/bootstrap-data.mjs
```

```bash
# Bash
SUPABASE_SERVICE_ROLE_KEY="<paste-service-role-key>" node scripts/bootstrap-data.mjs
```

The script is **idempotent** — it skips uploads/inserts that already exist,
so re-running it is harmless. After it finishes, refresh the live site;
the three new cards should appear with logos.

## 4. Deploy (Netlify)

```powershell
npm run build
netlify deploy --prod
```

`netlify.toml` already includes the SPA redirect (`/* → /index.html 200`).
Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify → Site settings →
Environment variables.

---

## Project layout

```
db/
  schema.sql            tables, is_super_admin(), RLS, storage policies, triggers
  seed.sql              trilingual starter projects
public/
  favicon.svg
  icons/                PWA icons (192, 512, 512-maskable) — swap for final art
  mascots/  (later)     drop qiaoqiao.png / claudio.png to replace placeholder art
src/
  lib/        supabase.js (client + localized()), queries.js, useFetch.js
  i18n/       index.js + locales/{zh,it,en}.json
  components/ Header, LanguageSwitcher, Mascot, Status, BackLink,
              ProjectCard, CategoryFilter
  pages/      Home (grid + filter), ProjectDetail
  App.jsx     routes (admin routes stubbed for batch 2)
```

---

## Notes & assumptions (batch 1)

- **Design**: kept the family's token structure and component classes, retuned to
  a cool **teal/slate** palette (`--accent: #0e7490`) so CI-Tech reads as "the
  tech one" while still feeling part of the family.
- **Seed URLs**: only four live URLs were provided —
  `zhongwen-world.netlify.app` (CLF), `miaohong.netlify.app` (Miaohong),
  `ami168.online` (AMI168), and `florence-lantern2026.com`. Every other project
  (JCX Events, ZANG, AtelierOS, 沪深智投, SASA, and the four sibling apps) has
  `external_url = '#'` as a placeholder — **search `db/seed.sql` for `#`** and
  drop in the real links, or edit them from the admin panel once it's built.
  Cards with `#` show a disabled "Coming soon" button instead of "Visit".
- **Sibling descriptions** (Travel in Italia, ST-Progress, Feiyi, Design World)
  were taken from each app's PWA manifest so they read accurately.
- **Categories**: education / cultural / community / tools / other. The filter
  chips on the home page only show categories that actually have projects.
- **logo_url** is left empty in the seed on purpose — uploading logos via the
  admin panel is your first end-to-end test of Storage + RLS (batch 2).
- **PWA**: `/admin` is excluded from the offline shell (`navigateFallbackDenylist`)
  so auth and writes always hit the network.
- **Mascots**: 巧巧 in ZH, Claudio in IT/EN — placeholder SVG avatars; replace
  per the comment in `src/components/Mascot.jsx`.

## Coming in batch 2

Auth (login at `/admin/login` with the sign-out-non-admins role check),
the Super Admin panel (trilingual add/edit/delete form, logo upload to Storage
with old-file cleanup, drag-and-drop reordering, publish/unpublish toggle).
```
