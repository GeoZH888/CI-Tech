// POST /api/translate
//
// Body: { text: string, from: 'zh'|'it'|'en', to: ('zh'|'it'|'en')[] }
// Returns: { translations: { <code>: string, ... } }
//
// Backed by Claude (default Haiku 4.5 — translation is its sweet spot).
// Reuses the ANTHROPIC_API_KEY env var set up for the chat function.
//
// Optional env var:  TRANSLATE_MODEL  — overrides the default model.

import Anthropic from '@anthropic-ai/sdk'

const LANG_NAMES = {
  zh: 'Chinese (Simplified)',
  it: 'Italian',
  en: 'English'
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return json({ error: 'not_configured', message: 'ANTHROPIC_API_KEY not set on Netlify' }, 503)

  let body
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const from = body?.from
  const to = Array.isArray(body?.to) ? body.to : []

  if (!text) return json({ error: 'invalid_request', message: 'text required' }, 400)
  if (!LANG_NAMES[from]) return json({ error: 'invalid_request', message: 'invalid from' }, 400)
  const targets = to.filter((l) => LANG_NAMES[l] && l !== from)
  if (targets.length === 0) return json({ translations: {} })
  if (text.length > 4000) return json({ error: 'too_long', message: 'text exceeds 4000 chars' }, 400)

  const fromName = LANG_NAMES[from]
  const targetList = targets.map((t) => `  - ${t}: ${LANG_NAMES[t]}`).join('\n')

  const userPrompt = `Translate the source text into each listed target language. The text describes a tech project (name / tagline / description), so keep the tone professional and concise. Preserve product names and proper nouns. Do not add explanations.

Source language: ${fromName}
Source text:
"""
${text}
"""

Targets:
${targetList}

Reply with ONLY a JSON object whose keys are the target language codes (${targets.join(', ')}) and values are the translated strings. No prose before or after, no markdown fences.`

  const client = new Anthropic({ apiKey })
  const model = process.env.TRANSLATE_MODEL || 'claude-haiku-4-5'

  let response
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: 'You are a precise translator. Always respond with valid JSON only — no commentary, no code fences.',
      messages: [{ role: 'user', content: userPrompt }]
    })
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500
    return json({ error: 'api_error', message: err?.message || 'upstream' }, status)
  }

  const replyText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  // Be lenient — extract the first JSON object even if the model adds noise.
  const match = replyText.match(/\{[\s\S]*\}/)
  if (!match) return json({ error: 'parse_error', raw: replyText.slice(0, 200) }, 502)

  let translations
  try { translations = JSON.parse(match[0]) } catch {
    return json({ error: 'parse_error', raw: replyText.slice(0, 200) }, 502)
  }

  // Filter to only the requested codes; coerce values to strings.
  const out = {}
  for (const code of targets) {
    if (translations[code] != null) out[code] = String(translations[code])
  }

  return json({ translations: out, model: response.model, usage: response.usage })
}

export const config = { path: '/api/translate' }
