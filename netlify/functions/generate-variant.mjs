// POST /api/generate-variant
//
// Generates one or more variant images of an IP character. Two providers:
//
//   provider: 'replicate'  (default)  Flux-Redux / PuLID-Flux on Replicate.
//                                     Best for character-consistent variations.
//   provider: 'stability'             Stability AI control/style: preserves
//                                     the reference image's style/identity
//                                     while applying the scene prompt.
//
// Body: { character_id, scene, num_outputs (1-4), provider? }
// Auth: Authorization: Bearer <session.access_token>  — must be super_admin
//
// Required env vars on Netlify (depends on provider):
//   REPLICATE_API_TOKEN              (when provider='replicate')
//   STABILITY_API_KEY                (when provider='stability')
//   SUPABASE_SERVICE_ROLE_KEY        — for Storage write + DB insert
//   SUPABASE_URL (or VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
//
// Optional:
//   REPLICATE_MODEL                  — default 'black-forest-labs/flux-redux-dev'
//   STABILITY_VARIANT_ENDPOINT       — default 'control/style' (style transfer);
//                                       try 'control/structure' for stricter
//                                       composition preservation.

import { createClient } from '@supabase/supabase-js'

const REPLICATE_API = 'https://api.replicate.com/v1'
const STABILITY_API = 'https://api.stability.ai/v2beta/stable-image'
const DEFAULT_REPLICATE_MODEL = 'black-forest-labs/flux-redux-dev'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN
const STABILITY_KEY = process.env.STABILITY_API_KEY
const REPLICATE_MODEL = process.env.REPLICATE_MODEL || DEFAULT_REPLICATE_MODEL
const STABILITY_ENDPOINT = process.env.STABILITY_VARIANT_ENDPOINT || 'control/style'

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

// ----- Replicate: kick a prediction, poll until ready, download N outputs -----
async function generateWithReplicate(character, prompt, n) {
  const [owner, modelName] = REPLICATE_MODEL.split('/')
  if (!owner || !modelName) throw new Error(`bad REPLICATE_MODEL: ${REPLICATE_MODEL}`)

  const predResp = await fetch(`${REPLICATE_API}/models/${owner}/${modelName}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=8'
    },
    body: JSON.stringify({
      input: {
        // Each model reads what it knows about; the rest are ignored.
        redux_image: character.base_image_url,
        image: character.base_image_url,
        main_face_image: character.base_image_url,
        face_image: character.base_image_url,
        prompt,
        num_outputs: n,
        output_format: 'png'
      }
    })
  })
  if (!predResp.ok) {
    const t = await predResp.text().catch(() => '')
    throw new Error(`replicate ${predResp.status}: ${t.slice(0, 200)}`)
  }
  let prediction = await predResp.json()

  const start = Date.now()
  while (['starting', 'processing'].includes(prediction.status)) {
    if (Date.now() - start > 6000) {
      const err = new Error('still_processing')
      err.code = 'still_processing'
      err.prediction_id = prediction.id
      throw err
    }
    await new Promise((r) => setTimeout(r, 1500))
    const p = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` }
    })
    if (!p.ok) throw new Error(`replicate poll ${p.status}`)
    prediction = await p.json()
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(prediction.error || prediction.status)
  }

  const urls = Array.isArray(prediction.output)
    ? prediction.output
    : prediction.output ? [prediction.output] : []
  const buffers = []
  for (const url of urls) {
    if (!url) continue
    const r = await fetch(url)
    if (!r.ok) continue
    buffers.push(Buffer.from(await r.arrayBuffer()))
  }
  return {
    buffers,
    meta: { model: REPLICATE_MODEL, prediction_id: prediction.id, provider: 'replicate' }
  }
}

// ----- Stability: N parallel control/style requests with the reference image -----
async function generateWithStability(character, prompt, n) {
  const refResp = await fetch(character.base_image_url)
  if (!refResp.ok) throw new Error(`could not fetch base image: ${refResp.status}`)
  const refBuf = Buffer.from(await refResp.arrayBuffer())

  const endpoint = `${STABILITY_API}/${STABILITY_ENDPOINT}`
  const ts = Date.now()

  async function one(i) {
    const form = new FormData()
    // The Stability "control/style" endpoint expects 'image' as the reference
    // and 'prompt' as the desired scene.
    form.append('image', new Blob([refBuf], { type: 'image/png' }), 'ref.png')
    form.append('prompt', prompt || 'character in a new scene')
    form.append('output_format', 'png')
    form.append('fidelity', '0.6')
    form.append('seed', String(ts + i * 7919))

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STABILITY_KEY}`,
        Accept: 'image/*'
      },
      body: form
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      throw new Error(`stability ${r.status}: ${t.slice(0, 200)}`)
    }
    return Buffer.from(await r.arrayBuffer())
  }

  const settled = await Promise.allSettled(Array.from({ length: n }, (_, i) => one(i)))
  const buffers = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  if (buffers.length === 0) {
    const firstErr = settled.find((r) => r.status === 'rejected')
    throw new Error(firstErr?.reason?.message || 'stability: all candidates failed')
  }
  return {
    buffers,
    meta: { model: `stability/${STABILITY_ENDPOINT}`, provider: 'stability' }
  }
}

// ----- Shared: upload buffers + insert ct_ip_variants rows -----
async function persistVariants(sbAdmin, character, scene, prompt, buffers, meta) {
  const charSlug = slugify(character.name)
  const sceneSlug = slugify(scene || 'variant', 24)
  const ts = Date.now()
  const variants = []

  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i]
    if (!buf) continue
    const path = `variants/${charSlug}-${sceneSlug}-${ts}-${i}.png`
    const { error: upErr } = await sbAdmin.storage
      .from('ip-characters')
      .upload(path, buf, { contentType: 'image/png', upsert: false })
    if (upErr) continue
    const publicUrl = sbAdmin.storage.from('ip-characters').getPublicUrl(path).data.publicUrl
    const { data: variant, error: insErr } = await sbAdmin
      .from('ct_ip_variants')
      .insert({
        character_id: character.id,
        scene: scene || null,
        prompt,
        image_url: publicUrl,
        metadata: meta
      })
      .select()
      .single()
    if (!insErr && variant) variants.push(variant)
  }
  return variants
}

// ============================================================================
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

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

  let body
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const { character_id, scene, num_outputs } = body || {}
  if (!character_id) return json({ error: 'invalid_request', message: 'character_id required' }, 400)
  const n = Math.min(4, Math.max(1, Number(num_outputs) || 1))
  const provider = (body?.provider || 'replicate').toString().toLowerCase()

  if (provider === 'stability' && !STABILITY_KEY) {
    return json({ error: 'not_configured', message: 'STABILITY_API_KEY not set' }, 503)
  }
  if (provider === 'replicate' && !REPLICATE_TOKEN) {
    return json({ error: 'not_configured', message: 'REPLICATE_API_TOKEN not set' }, 503)
  }

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: character, error: charErr } = await sbAdmin
    .from('ct_ip_characters')
    .select('id, name, base_prompt, base_image_url')
    .eq('id', character_id)
    .maybeSingle()
  if (charErr || !character) return json({ error: 'character_not_found' }, 404)
  if (!character.base_image_url) {
    return json({ error: 'no_base_image', message: 'This character has no base image yet.' }, 400)
  }

  const prompt = [character.base_prompt, scene].filter(Boolean).join(', ')

  let result
  try {
    result = provider === 'stability'
      ? await generateWithStability(character, prompt, n)
      : await generateWithReplicate(character, prompt, n)
  } catch (err) {
    if (err?.code === 'still_processing') {
      return json(
        {
          error: 'still_processing',
          prediction_id: err.prediction_id,
          message: 'Generation still running on Replicate. Try again in a few seconds or switch to a faster model.'
        },
        202
      )
    }
    return json(
      { error: 'generation_failed', message: err?.message || String(err), provider },
      502
    )
  }

  const variants = await persistVariants(sbAdmin, character, scene, prompt, result.buffers, result.meta)
  if (variants.length === 0) return json({ error: 'all_uploads_failed' }, 502)

  return json({ variants, provider, model: result.meta.model })
}

export const config = { path: '/api/generate-variant' }
