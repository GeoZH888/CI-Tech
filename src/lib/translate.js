// Tiny client for /api/translate (the Claude-backed translate function).
// Given a source string + source lang code + array of target codes, returns
// an object whose keys are the targets and values are the translated text.
export async function translate(text, from, toLangs) {
  const resp = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, from, to: toLangs })
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${resp.status}`)
    err.code = data?.error
    throw err
  }
  return data.translations || {}
}
