# CI-WORLD — Project Showcase

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

## 3b. AI assistant (Claude) — optional but recommended

Each project detail page has a mascot-led chat widget (巧巧 in ZH, Claudio in
IT/EN) that introduces the project and answers questions about it. It's backed
by `netlify/functions/chat.mjs`, which calls Claude through the Anthropic API.

**Setup:**

```powershell
# 1. Get an Anthropic API key: https://console.anthropic.com/settings/keys
# 2. Set it as a Netlify env var (production context):
netlify env:set ANTHROPIC_API_KEY "sk-ant-api03-..."

# 3. (Optional) override the model — defaults to claude-haiku-4-5
#    Switch to claude-opus-4-7 for higher quality at ~5× the cost.
# netlify env:set CHAT_MODEL "claude-opus-4-7"

# 4. Redeploy so the function picks up the env var:
npm run build
netlify deploy --prod --dir=dist --functions=netlify/functions
```

**Cost expectations** (rough, per Q&A turn):

| Model               | Input $/1M | Output $/1M | Typical turn |
|---------------------|-----------:|------------:|-------------:|
| `claude-haiku-4-5`  |       $1   |       $5    |   ~$0.001    |
| `claude-opus-4-7`   |       $5   |      $25    |   ~$0.005    |

The function trims history to the last 10 messages and caps each message at
2000 chars to keep cost bounded. Without `ANTHROPIC_API_KEY` set, the widget
shows a friendly "assistant isn't configured yet" message instead of failing.

## 3c. IP Studio (super-admin character library + variant generation)

A super-admin-only studio for managing branded characters (like Claudio) and
generating Flux-Redux variants of them. Each variant can be attached to a
project as its chat-widget avatar (`ct_projects.mascot_variant_id`).

**One-time SQL setup** — in the Supabase SQL editor, run **`db/ip-studio.sql`**.
It adds the tables (`ct_ip_characters`, `ct_ip_variants`), RLS policies,
the `ip-characters` Storage bucket, and the `mascot_variant_id` column on
`ct_projects`.

**Netlify env vars** for `/api/generate-variant`:

| Env var | Purpose | How to get it |
|---|---|---|
| `REPLICATE_API_TOKEN` | Calls Replicate to generate variants | https://replicate.com/account/api-tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Writes generated variants to Storage + DB (bypasses RLS server-side; **secret**) | Supabase Dashboard → Project Settings → API → "service_role" (reveal) |
| `SUPABASE_URL` | (Optional if already set as `VITE_SUPABASE_URL`) | Same as your local `.env` |
| `SUPABASE_ANON_KEY` | (Optional if already set as `VITE_SUPABASE_ANON_KEY`) | Same as your local `.env` |
| `REPLICATE_MODEL` | (Optional override; default `black-forest-labs/flux-redux-dev`) | For prompt-driven scene control try a PuLID-Flux model |

```powershell
netlify env:set REPLICATE_API_TOKEN "r8_..."
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJhbGciOiJ...secret..."
netlify env:set SUPABASE_URL "https://<project>.supabase.co"
netlify env:set SUPABASE_ANON_KEY "eyJhbGciOi...anon..."
npm run build
netlify deploy --prod --dir=dist --functions=netlify/functions
```

**Cost (rough):** ~$0.04 per variant on Flux Redux Dev. 10 characters × 10
variants = $4. Plus negligible Supabase Storage costs.

### Logo generation (Stability AI)

The "Generate project logo" panel at the bottom of `/admin/ip-studio` uses
Stability AI to make 1–4 logo candidates for any selected project. Clicking
"Use as logo" on a candidate writes its URL to `ct_projects.logo_url` and
deletes the previous logo from Storage.

Add the Stability key on Netlify (get one at https://platform.stability.ai/account/keys):

```powershell
netlify env:set STABILITY_API_KEY "sk-..."
# Optional model overrides:
# netlify env:set STABILITY_LOGO_MODEL "core"   # default — cheapest, ~$0.03/img
# netlify env:set STABILITY_LOGO_MODEL "sd3"    # SD3.5 Large, ~$0.065/img
# netlify env:set STABILITY_LOGO_MODEL "ultra"  # Stable Image Ultra, ~$0.08/img
```

The variant generator also accepts `provider: 'stability'` (dropdown in the
Generate-variant form) — it uses Stability's `control/style` endpoint to
preserve the reference character's appearance while applying the scene
prompt. For best character consistency, Replicate Flux Redux remains the
recommended default; switch to Stability when you want speed or different
aesthetic baselines.

### Choosing a generation model

The default `REPLICATE_MODEL=black-forest-labs/flux-redux-dev` is great at
producing **more poses / angles / micro-variations of the same image**, but
it doesn't strongly drive the scene from a text prompt — Redux is an
image-variation model, not text-conditioned img2img.

For **prompt-driven scene control** (e.g. "Claudio in a library reading",
"Claudio at a coffee shop laptop") you want a **PuLID-Flux** model — it
preserves the face from your reference image while letting the prompt
control the scene. The generate-variant function already sends the
reference under every common field name (`redux_image`, `image`,
`main_face_image`, `face_image`), so swapping models is a one-line env-var
change:

```powershell
# PuLID-Flux — prompt-driven scenes around the reference character
netlify env:set REPLICATE_MODEL "lucataco/flux-pulid"

# Then redeploy so the function picks up the new env var:
npm run build
netlify deploy --prod --dir=dist --functions=netlify/functions
```

Quick comparison:

| Model | What it's good at | Prompt weight | Cost / image |
|---|---|---:|---:|
| `black-forest-labs/flux-redux-dev` (default) | Variations of the reference (poses, angles) | low | ~$0.04 |
| `lucataco/flux-pulid` | Reference identity + scene from prompt | high | ~$0.05 |
| `lucataco/flux-dev-pulid` | Same idea, slightly different version | high | ~$0.05 |
| `fofr/flux-pulid` | Community fork; similar behavior | high | ~$0.05 |

Check current versions and pricing at https://replicate.com — the slugs
above match what's typically online but model authors occasionally
rename/replace versions. Any model that accepts a reference image and a
text prompt should work without code changes.

If a chosen model needs **different input field names** (rare), edit
`netlify/functions/generate-variant.mjs` — the `input` object inside the
Replicate POST is where to add them.

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
