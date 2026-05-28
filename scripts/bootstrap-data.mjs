// One-shot bootstrap: uploads the three logos in /icons and images/ to the
// project-logos bucket, then inserts the three new projects (Ciao News,
// LINGUA, Patente) and updates the existing Feiyi row's logo_url.
//
// Requires a service-role key because RLS only lets a super-admin write.
// Run from the repo root:
//
//   Windows (PowerShell):
//     $env:SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
//     node scripts/bootstrap-data.mjs
//
//   Bash:
//     SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" node scripts/bootstrap-data.mjs
//
// The SERVICE-ROLE key is a SECRET. Never commit it, never paste it in
// production code. Get it from Supabase dashboard:
//   Project Settings → API → Project API keys → "service_role" (reveal).
//
// Safe to re-run: skips uploads/inserts that already exist.

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const IMG_DIR = resolve(ROOT, 'icons and images')

// ---- read .env for the project URL (the anon key is not enough — we need
//      the service role key from the environment) ----------------------
async function loadEnvUrl() {
  const text = await readFile(resolve(ROOT, '.env'), 'utf-8').catch(() => '')
  const m = text.match(/^VITE_SUPABASE_URL\s*=\s*(.+)$/m)
  return m ? m[1].trim() : process.env.SUPABASE_URL
}

const SUPABASE_URL = await loadEnvUrl()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('✗ No Supabase URL found. Set VITE_SUPABASE_URL in .env or SUPABASE_URL in the environment.')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error('✗ Set SUPABASE_SERVICE_ROLE_KEY in the environment (see the comment at the top of this file).')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// ---- helpers --------------------------------------------------------------
function slugify(s) {
  return (s || 'logo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'logo'
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' }

// Upload a local file to the project-logos bucket as <slug>-<timestamp>.<ext>,
// unless an object whose name starts with <slug>- already exists in the bucket
// (in which case we reuse it — re-runs don't pile up duplicates).
async function uploadLogoOnce(localFilename, slugHint) {
  const ext = localFilename.split('.').pop().toLowerCase()
  const contentType = MIME[ext]
  if (!contentType) throw new Error(`Unsupported logo extension: ${localFilename}`)
  const slug = slugify(slugHint)

  // already there?
  const { data: existing } = await sb.storage.from('project-logos').list('', { search: slug })
  const hit = (existing || []).find((o) => o.name.startsWith(slug + '-'))
  if (hit) {
    const url = sb.storage.from('project-logos').getPublicUrl(hit.name).data.publicUrl
    console.log(`  ↻ reusing existing ${hit.name}`)
    return url
  }

  const buf = await readFile(resolve(IMG_DIR, localFilename))
  const path = `${slug}-${Date.now()}.${ext}`
  const { error } = await sb.storage
    .from('project-logos')
    .upload(path, buf, { contentType, upsert: false })
  if (error) throw error
  const url = sb.storage.from('project-logos').getPublicUrl(path).data.publicUrl
  console.log(`  ✓ uploaded ${path}`)
  return url
}

// Insert if no project shares this name_en yet; otherwise just update logo_url.
async function upsertProjectByNameEn(row) {
  const { data: existing, error: selErr } = await sb
    .from('ct_projects')
    .select('id, logo_url')
    .eq('name_en', row.name_en)
    .maybeSingle()
  if (selErr) throw selErr

  if (existing) {
    const { error } = await sb
      .from('ct_projects')
      .update({ logo_url: row.logo_url })
      .eq('id', existing.id)
    if (error) throw error
    console.log(`  ↻ updated logo for "${row.name_en}"`)
    return
  }

  const { error } = await sb.from('ct_projects').insert(row)
  if (error) throw error
  console.log(`  ✓ inserted "${row.name_en}"`)
}

// ---- run ------------------------------------------------------------------
console.log(`Bootstrapping logos + projects at ${SUPABASE_URL}`)
console.log(`Image source: ${IMG_DIR}`)
console.log('Files in source folder:', (await readdir(IMG_DIR)).join(', '))
console.log('')

console.log('▶ Uploading logos…')
const newsUrl = await uploadLogoOnce('news.png', 'ciao-news')
const patenteUrl = await uploadLogoOnce('Patente.png', 'patente')
const feiyiUrl = await uploadLogoOnce('feiyi.png', 'feiyi')

console.log('')
console.log('▶ Inserting / updating projects…')

await upsertProjectByNameEn({
  name_zh: 'Ciao News · 你好意大利',
  name_it: 'Ciao News',
  name_en: 'Ciao News',
  tagline_zh: '中意双语新闻与文化平台',
  tagline_it: 'Notizie e cultura bilingue Italia-Cina',
  tagline_en: 'Bilingual Italy–China news & culture',
  description_zh: 'Ciao News 是一个中意双语的新闻与文化平台，连接两国的读者与社区。',
  description_it: "Ciao News è una piattaforma di notizie e cultura bilingue (italiano/cinese), un ponte tra le due comunità.",
  description_en: 'Ciao News is a bilingual Italy–China news and culture platform — a bridge between the two communities.',
  category: 'community',
  external_url: '#',
  logo_url: newsUrl,
  tech_stack: ['React', 'Vite', 'Supabase'],
  sort_order: 35,
  is_published: true
})

await upsertProjectByNameEn({
  name_zh: 'LINGUA · 意大利语学习',
  name_it: "LINGUA — Impara l'italiano",
  name_en: 'LINGUA — Learn Italian',
  tagline_zh: '面向中国学习者的意大利语 PWA',
  tagline_it: "Imparare l'italiano, per studenti cinesi",
  tagline_en: 'Italian for Chinese learners',
  description_zh: 'LINGUA 是一款面向中国学习者的意大利语学习 PWA，覆盖发音、语法与口语练习。',
  description_it: "LINGUA è una PWA per imparare l'italiano dedicata agli studenti cinesi, con pronuncia, grammatica e pratica orale.",
  description_en: 'LINGUA is a PWA for learning Italian aimed at Chinese students, with pronunciation, grammar and speaking practice.',
  category: 'education',
  external_url: '#',
  logo_url: newsUrl, // same handshake logo per request (Image #2 == Image #1)
  tech_stack: ['React', 'Vite', 'Supabase', 'PWA'],
  sort_order: 25,
  is_published: true
})

await upsertProjectByNameEn({
  name_zh: 'Patente · 意大利驾照',
  name_it: 'Patente — Esame di guida',
  name_en: 'Patente — Italian Driving Licence',
  tagline_zh: '意大利驾照理论考试三语备考',
  tagline_it: 'Preparazione esame teorico patente, in tre lingue',
  tagline_en: 'Italian driving-theory prep, in three languages',
  description_zh: 'Patente 是一款帮助考生通过意大利驾照理论考试的三语应用，包含题库、模拟测试与重点解析。',
  description_it: "Patente è un'app trilingue per superare l'esame teorico della patente italiana, con quiz, simulazioni e ripasso.",
  description_en: "Patente is a trilingual app to help you pass Italy's driving-theory exam, with quizzes, mock tests and key-concept review.",
  category: 'education',
  external_url: '#',
  logo_url: patenteUrl,
  tech_stack: ['React', 'Vite', 'Supabase'],
  sort_order: 28,
  is_published: true
})

// Feiyi already exists in the seed — just attach its logo.
{
  const { error } = await sb
    .from('ct_projects')
    .update({ logo_url: feiyiUrl })
    .eq('name_en', '非遗 · Feiyi')
  if (error) throw error
  console.log('  ↻ updated logo for "非遗 · Feiyi"')
}

console.log('')
console.log('✓ Done.')
