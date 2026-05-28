import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Mascot.css'

/*
 * Mascot system (shared with the sibling apps)
 * --------------------------------------------
 * Two guides that switch by active UI language:
 *   - 巧巧 (Qiǎoqiǎo), female, shown when language is `zh`
 *   - Claudio,        male,   shown when language is `it` or `en`
 *
 * The speech-bubble tip is trilingual and pulled from i18n (mascot.tips.<tipKey>),
 * so pass a `tipKey` matching the current page (e.g. "home", "detail", "admin").
 *
 * >>> REPLACE PLACEHOLDER ART HERE <<<
 * The avatars below are inline placeholder SVGs (clearly-female / clearly-male
 * friendly characters). To use final artwork, drop files into /public/mascots/
 * (e.g. qiaoqiao.png, claudio.png) and swap the <PlaceholderAvatar/> for:
 *   <img src={`/mascots/${isZh ? 'qiaoqiao' : 'claudio'}.png`} alt={name} />
 */

function QiaoqiaoAvatar() {
  // Placeholder: friendly female guide — bob haircut, warm dress.
  return (
    <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#f6d186" />
      {/* hair back */}
      <path d="M16 44a24 24 0 0 1 48 0c0 6-4 6-4 6H20s-4 0-4-6z" fill="#4a3528" />
      {/* face */}
      <circle cx="40" cy="40" r="17" fill="#ffe0c2" />
      {/* fringe */}
      <path d="M23 36c2-9 9-14 17-14s15 5 17 14c-5-3-11-4-17-4s-12 1-17 4z" fill="#4a3528" />
      {/* eyes */}
      <circle cx="34" cy="40" r="2.2" fill="#2e211a" />
      <circle cx="46" cy="40" r="2.2" fill="#2e211a" />
      {/* smile */}
      <path d="M35 47c2 2.5 8 2.5 10 0" stroke="#0e7490" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="31" cy="45" r="2" fill="#f3a98e" opacity="0.7" />
      <circle cx="49" cy="45" r="2" fill="#f3a98e" opacity="0.7" />
      {/* flower accent (feminine cue) */}
      <circle cx="55" cy="30" r="3.5" fill="#0e7490" />
      <circle cx="55" cy="30" r="1.3" fill="#f6d186" />
    </svg>
  )
}

function ClaudioAvatar() {
  // Placeholder: friendly male guide — short hair, moustache.
  return (
    <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="#bcd0a0" />
      {/* hair */}
      <path d="M24 34c0-9 7-15 16-15s16 6 16 15c-4-3-9-4-16-4s-12 1-16 4z" fill="#3a2a1c" />
      {/* face */}
      <circle cx="40" cy="40" r="17" fill="#ffe0c2" />
      {/* eyebrows */}
      <path d="M31 35h6M43 35h6" stroke="#3a2a1c" strokeWidth="2" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="34" cy="40" r="2.2" fill="#2e211a" />
      <circle cx="46" cy="40" r="2.2" fill="#2e211a" />
      {/* moustache (masculine cue) */}
      <path d="M33 49c2 2 5 2 7 0 2 2 5 2 7 0" stroke="#3a2a1c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* smile */}
      <path d="M36 52c2 2 6 2 8 0" stroke="#0e7490" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function Mascot({ tipKey = 'home' }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(true)

  const isZh = i18n.language === 'zh'
  const name = t('mascot.name') // 巧巧 or Claudio
  const tip = t(`mascot.tips.${tipKey}`, { defaultValue: t('mascot.tips.home') })

  return (
    <div className="mascot" data-mascot={isZh ? 'qiaoqiao' : 'claudio'}>
      {open && (
        <div className="mascot-bubble" role="status">
          <button
            className="mascot-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <strong className="mascot-name">{name}</strong>
          <p>{tip}</p>
        </div>
      )}
      <button
        className="mascot-avatar"
        title={name}
        aria-label={name}
        onClick={() => setOpen((v) => !v)}
      >
        {isZh ? <QiaoqiaoAvatar /> : <ClaudioAvatar />}
      </button>
    </div>
  )
}
