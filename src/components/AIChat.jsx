import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/*
 * AIChat — small mascot-led Q&A widget for a project detail page.
 *
 * It POSTs to /api/chat (Netlify Function → Claude API). The function
 * builds the system prompt with the mascot persona + project context, so
 * we just pass the project payload and the running message history.
 *
 * Mascot identity follows the active language (same convention as <Mascot/>):
 *   zh  → 巧巧 (Qiǎoqiǎo)
 *   it  → Claudio
 *   en  → Claudio
 *
 * Errors are shown inline (no toast/modal). A 503 with error="not_configured"
 * is treated specially so non-deployed previews show a friendly message
 * instead of "Chat failed."
 */
export default function AIChat({ project }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const isZh = lang === 'zh'
  const name = isZh ? '巧巧' : 'Claudio'

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [disabled, setDisabled] = useState(false) // true on 503 not_configured

  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy])

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setError('')
    setInput('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, messages: next, lang })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.error === 'not_configured') {
          setDisabled(true)
          setError(t('chat.notConfigured'))
        } else {
          setError(data?.message || t('chat.error'))
        }
        return
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || '' }])
    } catch (err) {
      setError(err?.message || t('chat.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ai-chat" aria-label={t('chat.intro')}>
      <header className="ai-chat-header">
        <span className="ai-chat-avatar" aria-hidden="true">
          {isZh ? <Qiao /> : <Claud />}
        </span>
        <div className="ai-chat-title">
          <strong>{name}</strong>
          <span className="muted"> · {t('chat.intro')}</span>
        </div>
      </header>

      <div className="ai-chat-messages">
        {messages.length === 0 && !error && (
          <p className="ai-chat-greeting">
            {t('chat.greeting', { name })}
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ai-chat-msg ai-chat-msg-${m.role}`}>
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="ai-chat-msg ai-chat-msg-assistant ai-chat-typing">
            <span /><span /><span />
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form className="ai-chat-input" onSubmit={send}>
        <input
          type="text"
          placeholder={t('chat.placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || disabled}
          aria-label={t('chat.placeholder')}
          maxLength={2000}
        />
        <button className="btn btn-sm" type="submit" disabled={busy || disabled || !input.trim()}>
          {busy ? t('chat.sending') : t('chat.send')}
        </button>
      </form>
    </section>
  )
}

// ----- mini-mascot avatars (smaller variants of <Mascot/>'s art) -----
function Qiao() {
  return (
    <svg viewBox="0 0 80 80" width="40" height="40" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#f6d186" />
      <path d="M16 44a24 24 0 0 1 48 0c0 6-4 6-4 6H20s-4 0-4-6z" fill="#4a3528" />
      <circle cx="40" cy="40" r="17" fill="#ffe0c2" />
      <path d="M23 36c2-9 9-14 17-14s15 5 17 14c-5-3-11-4-17-4s-12 1-17 4z" fill="#4a3528" />
      <circle cx="34" cy="40" r="2.2" fill="#2e211a" />
      <circle cx="46" cy="40" r="2.2" fill="#2e211a" />
      <path d="M35 47c2 2.5 8 2.5 10 0" stroke="#0e7490" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="55" cy="30" r="3.5" fill="#0e7490" />
      <circle cx="55" cy="30" r="1.3" fill="#f6d186" />
    </svg>
  )
}
function Claud() {
  return (
    <svg viewBox="0 0 80 80" width="40" height="40" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#bcd0a0" />
      <path d="M24 34c0-9 7-15 16-15s16 6 16 15c-4-3-9-4-16-4s-12 1-16 4z" fill="#3a2a1c" />
      <circle cx="40" cy="40" r="17" fill="#ffe0c2" />
      <path d="M31 35h6M43 35h6" stroke="#3a2a1c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="34" cy="40" r="2.2" fill="#2e211a" />
      <circle cx="46" cy="40" r="2.2" fill="#2e211a" />
      <path d="M33 49c2 2 5 2 7 0 2 2 5 2 7 0" stroke="#3a2a1c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M36 52c2 2 6 2 8 0" stroke="#0e7490" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}
