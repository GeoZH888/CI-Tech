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

// ---- generation (Replicate via Netlify Function) ----------------------
export async function generateVariant({ characterId, scene, numOutputs }) {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (!session) throw new Error('not_signed_in')

  const resp = await fetch('/api/generate-variant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      character_id: characterId,
      scene,
      num_outputs: numOutputs
    })
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
