// Project-scoped chat endpoint backed by Claude (Anthropic API).
//
// POST /api/chat   body: { project, messages, lang }
//   project   — the full project row (name_*/tagline_*/description_*/category/
//               external_url/tech_stack). Sent from the client because the
//               project is already loaded for the detail page; the function
//               doesn't need its own Supabase round-trip.
//   messages  — array of { role: "user" | "assistant", content: string }
//   lang      — "zh" | "it" | "en"
//
// Persona is Claudio across ALL languages — he simply replies in the user's
// active language. (This differs from the corner Mascot, which switches
// between 巧巧 and Claudio by language; here the AI assistant is always Claudio.)
//
// Required env var on Netlify:  ANTHROPIC_API_KEY
// Optional env var:             CHAT_MODEL  (default "claude-haiku-4-5")

import Anthropic from '@anthropic-ai/sdk'

// Persona + tone instructions, per language. Same character (Claudio) in all
// three; only the reply-language and phrasing change.
const PERSONAS = {
  zh: `你是 Claudio，CI-Tech 技术项目展示的 AI 助手。请用中文回答，语气友好热情，通常 2–4 句。仅基于下方「项目信息」回答；遇到与该项目无关的问题，礼貌地说明你只能介绍这个项目。不要编造数据；不知道就承认。`,
  it: `Tu sei Claudio, l'assistente AI della vetrina di progetti tech CI-Tech. Rispondi in italiano, cordiale e conciso, di solito 2–4 frasi. Basati SOLO sulle informazioni del progetto qui sotto. Se la domanda non riguarda questo progetto, spiega gentilmente che puoi parlare solo di questo. Non inventare nulla; se non sai, dillo.`,
  en: `You are Claudio, the AI assistant for the CI-Tech tech project showcase. Reply in English, warm and concise — usually 2–4 sentences. Answer ONLY from the project info below. If the question isn't about this project, gently say you can only talk about this one. Don't make things up — if you don't know, say so.`
}

const MAX_HISTORY = 10
const MAX_MSG_CHARS = 2000

function buildSystemPrompt(project, lang) {
  const persona = PERSONAS[lang] || PERSONAS.en
  const tech = Array.isArray(project.tech_stack) ? project.tech_stack.join(', ') : '—'
  const ctx = [
    `Project name (ZH): ${project.name_zh || '—'}`,
    `Project name (IT): ${project.name_it || '—'}`,
    `Project name (EN): ${project.name_en || '—'}`,
    `Category: ${project.category || 'other'}`,
    `Tagline (${lang}): ${project[`tagline_${lang}`] || '—'}`,
    `Description (${lang}): ${project[`description_${lang}`] || '—'}`,
    `External URL: ${project.external_url || '—'}`,
    `Tech stack: ${tech}`
  ].join('\n')
  return `${persona}\n\n--- PROJECT INFO ---\n${ctx}\n--- END PROJECT INFO ---`
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
  if (!apiKey) {
    return json(
      { error: 'not_configured', message: 'Set ANTHROPIC_API_KEY on Netlify to enable the assistant.' },
      503
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { project, messages, lang } = body || {}
  if (!project || typeof project !== 'object' || !Array.isArray(messages)) {
    return json({ error: 'invalid_request' }, 400)
  }

  const langKey = ['zh', 'it', 'en'].includes(lang) ? lang : 'en'

  // Trim history + per-message length to keep cost bounded.
  const safeMessages = messages
    .slice(-MAX_HISTORY)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }))

  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== 'user') {
    return json({ error: 'invalid_request', message: 'messages must end with a user turn' }, 400)
  }

  const system = buildSystemPrompt(project, langKey)
  const model = process.env.CHAT_MODEL || 'claude-haiku-4-5'

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system,
      messages: safeMessages
    })

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    return json({ reply, usage: response.usage, model: response.model })
  } catch (err) {
    // Surface a short, safe error message; full details land in function logs.
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    const message = err?.error?.error?.message || err?.message || 'Upstream error'
    return json({ error: 'api_error', message }, status)
  }
}

export const config = { path: '/api/chat' }
