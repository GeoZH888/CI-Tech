import { supabase } from './supabase'

// ---- characters --------------------------------------------------------
export async function getCharacters() {
  const { data, error } = await supabase
    .from('ct_ip_characters')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createCharacter(payload) {
  const { data, error } = await supabase
    .from('ct_ip_characters')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCharacter(id, payload) {
  const { data, error } = await supabase
    .from('ct_ip_characters')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCharacter(id) {
  const { error } = await supabase.from('ct_ip_characters').delete().eq('id', id)
  if (error) throw error
}

// ---- variants ----------------------------------------------------------
export async function getVariants(characterId) {
  let q = supabase
    .from('ct_ip_variants')
    .select('*')
    .order('created_at', { ascending: false })
  if (characterId) q = q.eq('character_id', characterId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function deleteVariant(id) {
  const { error } = await supabase.from('ct_ip_variants').delete().eq('id', id)
  if (error) throw error
}

// ---- storage: character base images -----------------------------------
const CHAR_BUCKET = 'ip-characters'
const ACCEPTED = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
export const CHAR_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp'

export function validateCharImage(file) {
  if (!file) throw new Error('upload.noFile')
  if (!ACCEPTED[file.type]) throw new Error('upload.badType')
  if (file.size > 4 * 1024 * 1024) throw new Error('upload.tooBig')
}

function slugify(s) {
  return (s || 'character')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'character'
}

export async function uploadCharacterBaseImage(file, nameHint) {
  validateCharImage(file)
  const ext = ACCEPTED[file.type]
  const path = `bases/${slugify(nameHint)}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(CHAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from(CHAR_BUCKET).getPublicUrl(path).data.publicUrl
}

// ---- generation (Netlify Functions) -----------------------------------
async function authedPost(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not_signed_in')
  const resp = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(body)
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${resp.status}`)
    err.code = data?.error
    err.status = resp.status
    throw err
  }
  return data
}

// Variants: provider defaults to 'replicate' (Flux Redux). Pass 'stability'
// for SD3.5 control/style. Same response shape from both.
export async function generateVariant({ characterId, scene, numOutputs, provider }) {
  return authedPost('/api/generate-variant', {
    character_id: characterId,
    scene,
    num_outputs: numOutputs,
    provider
  })
}

// Logos: project-bound, Stability (Stable Image Core by default).
// Returns { candidates: [{ url, path, model, aspect_ratio }], prompt, model }.
// The chosen candidate is committed separately by setProjectLogo() so the
// user can preview before we touch ct_projects.
export async function generateLogos({ projectId, prompt, numOutputs, aspectRatio }) {
  return authedPost('/api/generate-logo', {
    project_id: projectId,
    prompt,
    num_outputs: numOutputs,
    aspect_ratio: aspectRatio
  })
}

// Commit one candidate as the project's logo, and best-effort delete the
// previous logo from Storage so it doesn't linger.
export async function setProjectLogo(projectId, newLogoUrl) {
  // Look up the current logo so we can clean it up after.
  const { data: existing } = await supabase
    .from('ct_projects')
    .select('logo_url')
    .eq('id', projectId)
    .single()
  const old = existing?.logo_url

  const { error } = await supabase
    .from('ct_projects')
    .update({ logo_url: newLogoUrl })
    .eq('id', projectId)
  if (error) throw error

  if (old && old !== newLogoUrl) {
    // Re-use the project-logos delete helper.
    const marker = '/object/public/project-logos/'
    const i = old.indexOf(marker)
    if (i !== -1) {
      const oldPath = decodeURIComponent(old.slice(i + marker.length))
      try { await supabase.storage.from('project-logos').remove([oldPath]) } catch { /* harmless */ }
    }
  }
}
