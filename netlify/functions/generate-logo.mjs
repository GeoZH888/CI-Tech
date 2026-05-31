// POST /api/generate-logo
//
// Generates N candidate logos for a project via Stability AI's
// /v2beta/stable-image/generate/* endpoint, uploads them to the
// project-logos Storage bucket, returns the candidate URLs. The caller
// then picks one and PATCHes ct_projects.logo_url separately (handled by
// the front end so the user can pick before we commit).
//
// Body: { project_id, prompt, num_outputs (1-4), aspect_ratio: '1:1'|... }
// Auth: Authorization: Bearer <session.access_token>  — must be super_admin
//
// Required env vars on Netlify:
//   STABILITY_API_KEY                — from https://platform.stability.ai/account/keys
//   SUPABASE_SERVICE_ROLE_KEY        — for Storage write
//   SUPABASE_URL (or VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
//
// Optional:
//   STABILITY_LOGO_MODEL             — 'core' (default, cheap), 'sd3', 'ultra'
//   STABILITY_STYLE_PRESET           — e.g. 'flat-illustration', 'digital-art'

import { createClient } from '@supabase/supabase-js'

const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image/generate'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STABILITY_KEY = process.env.STABILITY_API_KEY
const MODEL = (process.env.STABILITY_LOGO_MODEL || 'core').toLowerCase()
const STYLE_PRESET = process.env.STABILITY_STYLE_PRESET || ''

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function slugify(s, max = 30) {
  return (s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'x'
}

function buildLogoPrompt(userPrompt) {
  // Strong style anchor so output is logo-shaped, not a "painting of a logo".
  const anchor = 'clean vector-style icon logo, centered, simple shapes, flat colors, isolated on white background, no text, no watermark'
  return userPrompt
    ? `${userPrompt}. ${anchor}`
    : anchor
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (!STABILITY_KEY) return json({ error: 'not_configured', message: 'STABILITY_API_KEY not set' }, 503)
  if (!SERVICE_KEY) return json({ error: 'not_configured', message: 'SUPABASE_SERVICE_ROLE_KEY not set' }, 503)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'not_configured', message: 'Supabase URL/anon key not set on Netlify' }, 503)
  }

  // auth: super_admin only
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const userToken = authHeader.slice(7)

  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data: userData, error: userErr } = await sbAnon.auth.getUser(userToken)
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)

  const { data: profile } = await sbAnon
    .from('ct_user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (profile?.role !== 'super_admin') return json({ error: 'forbidden' }, 403)

  // body
  let body
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const { project_id, prompt, num_outputs, aspect_ratio } = body || {}
  if (!project_id) return json({ error: 'invalid_request', message: 'project_id required' }, 400)
  const n = Math.min(4, Math.max(1, Number(num_outputs) || 1))
  const ar = ['1:1', '4:3', '3:4', '16:9', '9:16'].includes(aspect_ratio) ? aspect_ratio : '1:1'

  // admin client for storage + db
  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // look up project for slug
  const { data: project, error: projErr } = await sbAdmin
    .from('ct_projects')
    .select('id, name_en')
    .eq('id', project_id)
    .maybeSingle()
  if (projErr || !project) return json({ error: 'project_not_found' }, 404)

  const finalPrompt = buildLogoPrompt(typeof prompt === 'string' ? prompt.trim() : '')
  const endpoint = `${STABILITY_API}/${MODEL}`

  // Stability uses multipart/form-data. Each request returns ONE image, so
  // for N candidates we fan-out N requests. Stability's response is the
  // raw PNG when Accept: image/* (faster, fewer bytes than the base64 JSON).
  async function oneCandidate(i) {
    const form = new FormData()
    form.append('prompt', finalPrompt)
    form.append('aspect_ratio', ar)
    form.append('output_format', 'png')
    if (STYLE_PRESET) form.append('style_preset', STYLE_PRESET)
    form.append('seed', String(Date.now() + i * 7919)) // distinct seed per candidate

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STABILITY_KEY}`,
        Accept: 'image/*' // raw PNG
      },
      body: form
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(`stability ${resp.status}: ${errText.slice(0, 200)}`)
    }
    return Buffer.from(await resp.arrayBuffer())
  }

  const slug = slugify(project.name_en || 'project')
  const ts = Date.now()
  const candidates = []

  // Fan-out the N generations in parallel; Stability allows it on Core
  // (~1s each, so 4 candidates ≈ 1-2s total).
  const buffers = await Promise.allSettled(Array.from({ length: n }, (_, i) => oneCandidate(i)))

  for (let i = 0; i < buffers.length; i++) {
    const r = buffers[i]
    if (r.status !== 'fulfilled') continue
    const path = `candidates/${slug}-${ts}-${i}.png`
    const { error: upErr } = await sbAdmin.storage
      .from('project-logos')
      .upload(path, r.value, { contentType: 'image/png', upsert: false })
    if (upErr) continue
    const publicUrl = sbAdmin.storage.from('project-logos').getPublicUrl(path).data.publicUrl
    candidates.push({ url: publicUrl, path, model: `stability/${MODEL}`, aspect_ratio: ar })
  }

  if (candidates.length === 0) {
    const firstError = buffers.find((r) => r.status === 'rejected')
    return json(
      { error: 'all_failed', message: firstError?.reason?.message || 'no candidates produced' },
      502
    )
  }

  return json({ candidates, prompt: finalPrompt, model: `stability/${MODEL}` })
}

export const config = { path: '/api/generate-logo' }
