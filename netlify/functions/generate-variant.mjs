// POST /api/generate-variant
//
// Generates one or more variant images of an IP character using Replicate
// (Flux Redux by default), saves the outputs to the ip-characters Supabase
// Storage bucket, and inserts ct_ip_variants rows.
//
// Body: { character_id, scene, num_outputs (1-4) }
// Auth: Authorization: Bearer <session.access_token>  — must be a super_admin
//
// Required env vars on Netlify:
//   REPLICATE_API_TOKEN
//   SUPABASE_SERVICE_ROLE_KEY        — used to write to Storage + DB server-side
//   SUPABASE_URL (or VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
//
// Optional:
//   REPLICATE_MODEL                  — default 'black-forest-labs/flux-redux-dev'
//                                      For prompt-driven character-in-scene
//                                      variants try a PuLID-Flux model.

import { createClient } from '@supabase/supabase-js'

const REPLICATE_API = 'https://api.replicate.com/v1'
const DEFAULT_MODEL = 'black-forest-labs/flux-redux-dev'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN
const MODEL = process.env.REPLICATE_MODEL || DEFAULT_MODEL

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

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // -------- env-var checks --------
  if (!REPLICATE_TOKEN) return json({ error: 'not_configured', message: 'REPLICATE_API_TOKEN not set' }, 503)
  if (!SERVICE_KEY) return json({ error: 'not_configured', message: 'SUPABASE_SERVICE_ROLE_KEY not set' }, 503)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'not_configured', message: 'Supabase URL/anon key not set on Netlify' }, 503)
  }

  // -------- auth: caller must be a super_admin --------
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

  // -------- parse body --------
  let body
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const { character_id, scene, num_outputs } = body || {}
  if (!character_id) return json({ error: 'invalid_request', message: 'character_id required' }, 400)
  const n = Math.min(4, Math.max(1, Number(num_outputs) || 1))

  // -------- admin client for writes (bypasses RLS server-side) --------
  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // -------- load the character --------
  const { data: character, error: charErr } = await sbAdmin
    .from('ct_ip_characters')
    .select('id, name, base_prompt, base_image_url')
    .eq('id', character_id)
    .maybeSingle()
  if (charErr || !character) return json({ error: 'character_not_found' }, 404)
  if (!character.base_image_url) {
    return json({ error: 'no_base_image', message: 'This character has no base image yet.' }, 400)
  }

  // Compose the prompt the model sees. Redux ignores prompt, but PuLID-style
  // models use it for the scene; we send it either way.
  const prompt = [character.base_prompt, scene].filter(Boolean).join(', ')

  // -------- kick off the Replicate prediction --------
  const [owner, modelName] = MODEL.split('/')
  if (!owner || !modelName) return json({ error: 'bad_model', message: `Invalid REPLICATE_MODEL: ${MODEL}` }, 500)

  const predResp = await fetch(`${REPLICATE_API}/models/${owner}/${modelName}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
      // Prefer: wait=8 makes Replicate hold the connection up to 8 s before
      // responding — covers most flux-redux/schnell generations in one round-trip.
      Prefer: 'wait=8'
    },
    body: JSON.stringify({
      input: {
        // We pass the reference image under every common field name; each
        // model reads the one it knows about and ignores the rest.
        //   redux_image       → BFL flux-redux-*
        //   image             → generic img2img / many community models
        //   main_face_image   → lucataco/flux-pulid
        //   face_image        → fofr/flux-pulid and related PuLID forks
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
    const errText = await predResp.text().catch(() => '')
    return json(
      { error: 'replicate_error', status: predResp.status, message: errText.slice(0, 500) },
      502
    )
  }

  let prediction = await predResp.json()

  // Short additional poll loop in case Prefer: wait wasn't enough.
  const start = Date.now()
  while (['starting', 'processing'].includes(prediction.status)) {
    if (Date.now() - start > 6000) {
      // Don't hold Netlify too long — surface progress and let the client retry.
      return json(
        {
          error: 'still_processing',
          prediction_id: prediction.id,
          poll_url: prediction.urls?.get,
          message: 'Generation is still running on Replicate. Try the prompt again in a few seconds, or pick a faster model.'
        },
        202
      )
    }
    await new Promise((r) => setTimeout(r, 1500))
    const p = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` }
    })
    if (!p.ok) return json({ error: 'poll_failed' }, 502)
    prediction = await p.json()
  }

  if (prediction.status !== 'succeeded') {
    return json(
      { error: 'generation_failed', message: prediction.error || prediction.status },
      502
    )
  }

  // Normalize output to an array of URLs.
  const outputUrls = Array.isArray(prediction.output)
    ? prediction.output
    : prediction.output ? [prediction.output] : []
  if (outputUrls.length === 0) return json({ error: 'no_output' }, 502)

  // -------- download each output, upload to Storage, record DB row --------
  const charSlug = slugify(character.name)
  const sceneSlug = slugify(scene || 'variant', 24)
  const ts = Date.now()
  const variants = []

  for (let i = 0; i < outputUrls.length; i++) {
    const url = outputUrls[i]
    if (!url) continue
    try {
      const imgResp = await fetch(url)
      if (!imgResp.ok) continue
      const buf = Buffer.from(await imgResp.arrayBuffer())
      const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase()
      const path = `variants/${charSlug}-${sceneSlug}-${ts}-${i}.${ext}`
      const contentType =
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'webp' ? 'image/webp'
        : 'image/png'

      const { error: upErr } = await sbAdmin.storage
        .from('ip-characters')
        .upload(path, buf, { contentType, upsert: false })
      if (upErr) continue

      const publicUrl = sbAdmin.storage.from('ip-characters').getPublicUrl(path).data.publicUrl

      const { data: variant, error: insErr } = await sbAdmin
        .from('ct_ip_variants')
        .insert({
          character_id: character.id,
          scene: scene || null,
          prompt,
          image_url: publicUrl,
          metadata: {
            model: MODEL,
            prediction_id: prediction.id,
            replicate_url: url
          }
        })
        .select()
        .single()

      if (!insErr && variant) variants.push(variant)
    } catch {
      // swallow per-image errors; keep going so user still gets the others
    }
  }

  if (variants.length === 0) return json({ error: 'all_uploads_failed' }, 502)
  return json({ variants, model: MODEL })
}

export const config = { path: '/api/generate-variant' }
