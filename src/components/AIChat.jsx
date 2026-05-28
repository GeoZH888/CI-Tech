import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/*
 * AIChat — Claudio-led Q&A widget for a project detail page.
 *
 * It POSTs to /api/chat (Netlify Function → Claude API). The function
 * builds the system prompt with Claudio's persona + project context, so
 * we just pass the project payload and the running message history.
 *
 * The AI assistant is Claudio across ALL languages — he just answers in
 * the user's active language. (This differs from the corner <Mascot/>,
 * which switches between 巧巧 and Claudio by language.)
 *
 * Errors are shown inline (no toast/modal). A 503 with error="not_configured"
 * is treated specially so non-deployed previews show a friendly message
 * instead of "Chat failed."
 */
export default function AIChat({ project }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const name = 'Claudio'

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
          <Claud src={project?.mascot_variant?.image_url} />
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

// ----- Claudio avatar (real artwork — defaults to /public/mascots/claudio.png,
// or the project's chosen IP Studio variant when one is attached) ---------
function Claud({ src = '/mascots/claudio.png' }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="mascot-photo"
      width="40"
      height="40"
    />
  )
}
