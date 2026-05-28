import { supabase } from './supabase'

export const LOGO_BUCKET = 'project-logos'

// Accept common web image formats only, max ~2 MB.
const ACCEPTED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp'
}
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.svg,.webp'
const MAX_BYTES = 2 * 1024 * 1024

// "CLF Platform" -> "clf-platform"
function slugify(input) {
  return (input || 'logo')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '') // drop non-ascii (incl. Chinese) so the key is URL-safe
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'logo'
}

// Throws an Error (message is an i18n key) if the file is invalid.
export function validateLogo(file) {
  if (!file) throw new Error('upload.noFile')
  if (!ACCEPTED[file.type]) throw new Error('upload.badType')
  if (file.size > MAX_BYTES) throw new Error('upload.tooBig')
}

/**
 * Upload a logo to the project-logos bucket.
 * Filename: <slug>-<timestamp>.<ext> (e.g. clf-platform-1716808000.png).
 * Returns the public URL.
 */
export async function uploadLogo(file, nameHint) {
  validateLogo(file)
  const ext = ACCEPTED[file.type]
  const path = `${slugify(nameHint)}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (error) throw error

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Pull the in-bucket object path back out of a public URL, or null if this
// URL doesn't belong to our bucket (e.g. an externally hosted logo).
export function pathFromPublicUrl(url) {
  if (!url) return null
  const marker = `/object/public/${LOGO_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length))
}

// Best-effort delete of a previously uploaded logo. Never throws — a failed
// cleanup shouldn't block the user's save.
export async function deleteLogoByUrl(url) {
  const path = pathFromPublicUrl(url)
  if (!path) return
  try {
    await supabase.storage.from(LOGO_BUCKET).remove([path])
  } catch {
    /* ignore — orphaned file is harmless */
  }
}
