// One-shot: provision a super-admin account end-to-end.
//
// 1. Creates the auth user (or updates the password if it already exists)
//    via the Supabase Admin API (auth.admin.createUser / updateUserById).
// 2. Upserts ct_user_profiles to set role = 'super_admin' for that user.
//
// Idempotent. Safe to re-run — re-running resets the password and re-asserts
// the role.
//
// Run from the repo root:
//
//   Bash:
//     SUPERADMIN_EMAIL="you@example.com" \
//     SUPERADMIN_PASSWORD="ChooseAStrongOne!" \
//     node scripts/bootstrap-superadmin.mjs
//
//   PowerShell:
//     $env:SUPERADMIN_EMAIL="you@example.com"
//     $env:SUPERADMIN_PASSWORD="ChooseAStrongOne!"
//     node scripts/bootstrap-superadmin.mjs
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read from the env, or from
// VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in your .env file.
//
// The service-role key is SECRET — keep it out of source control and shell
// history. (It's in your .env, which .gitignore excludes.)

import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { readFile } from 'node:fs/promises'

// Node 20 doesn't ship native WebSocket by default; supabase-js's RealtimeClient
// crashes at construction without it. We aren't using realtime here, but the
// client still inits it — polyfill globalThis.WebSocket so the require resolves.
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = WebSocket
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

async function fromEnvFile(name) {
  const text = await readFile(resolve(ROOT, '.env'), 'utf-8').catch(() => '')
  const m = text.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
  return m ? m[1].trim() : null
}

const SUPABASE_URL =
  process.env.SUPABASE_URL || (await fromEnvFile('VITE_SUPABASE_URL'))
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || (await fromEnvFile('SUPABASE_SERVICE_ROLE_KEY'))
const EMAIL = process.env.SUPERADMIN_EMAIL
const PASSWORD = process.env.SUPERADMIN_PASSWORD

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

if (!SUPABASE_URL) fail('Missing SUPABASE_URL (or VITE_SUPABASE_URL in .env)')
if (!SERVICE_KEY) fail('Missing SUPABASE_SERVICE_ROLE_KEY')
if (!EMAIL) fail('Missing SUPERADMIN_EMAIL env var')
if (!PASSWORD || PASSWORD.length < 6) fail('Missing SUPERADMIN_PASSWORD (≥ 6 chars)')

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

console.log(`Provisioning super admin: ${EMAIL}`)

// 1. Find or create the auth user
const { data: list, error: listErr } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 1000
})
if (listErr) fail(`Could not list users: ${listErr.message}`)

const found = list.users.find(
  (u) => (u.email || '').toLowerCase() === EMAIL.toLowerCase()
)

let userId
if (found) {
  userId = found.id
  console.log('  ↻ user already exists — resetting password + re-confirming email')
  const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true
  })
  if (updErr) fail(`Failed to update user: ${updErr.message}`)
} else {
  console.log('  ✓ creating new auth user')
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true
  })
  if (createErr) fail(`Failed to create user: ${createErr.message}`)
  userId = created.user.id
}

// 2. Promote to super_admin
const { error: upsertErr } = await sb
  .from('ct_user_profiles')
  .upsert({ id: userId, email: EMAIL, role: 'super_admin' })
if (upsertErr) fail(`Failed to set role: ${upsertErr.message}`)

console.log(`✓ Super admin ready: ${EMAIL}`)
console.log('  Sign in at: https://ci-world.com/admin/login')
