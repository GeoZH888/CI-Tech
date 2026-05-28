import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdminBar from '../../components/AdminBar'
import { Loading } from '../../components/Status'
import {
  getCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  getVariants,
  deleteVariant,
  uploadCharacterBaseImage,
  generateVariant,
  CHAR_IMAGE_ACCEPT,
  validateCharImage
} from '../../lib/ipStudio'

export default function IPStudio() {
  const { t } = useTranslation()

  const [characters, setCharacters] = useState(null)
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // character form (inline; null = closed, {} = create, {...row} = edit)
  const [charForm, setCharForm] = useState(null)
  // generation
  const [genCharId, setGenCharId] = useState('')
  const [genScene, setGenScene] = useState('')
  const [genN, setGenN] = useState(2)
  const [genBusy, setGenBusy] = useState(false)
  const [genError, setGenError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getCharacters(), getVariants()])
      .then(([c, v]) => {
        if (!active) return
        setCharacters(c)
        setVariants(v)
        if (c.length > 0) setGenCharId((id) => id || c[0].id)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'load failed')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // ---------- character CRUD ----------
  async function saveCharacter(payload) {
    setError('')
    try {
      if (charForm?.id) {
        const saved = await updateCharacter(charForm.id, payload)
        setCharacters((list) => list.map((c) => (c.id === saved.id ? saved : c)))
      } else {
        const created = await createCharacter(payload)
        setCharacters((list) => [created, ...list])
        if (!genCharId) setGenCharId(created.id)
      }
      setCharForm(null)
    } catch (err) {
      setError(err.message || 'save failed')
    }
  }

  async function removeCharacter(c) {
    if (!confirm(t('ip.deleteCharConfirm', { name: c.name }))) return
    try {
      await deleteCharacter(c.id)
      setCharacters((list) => list.filter((x) => x.id !== c.id))
      setVariants((list) => list.filter((v) => v.character_id !== c.id))
      if (genCharId === c.id) setGenCharId('')
    } catch (err) {
      setError(err.message || 'delete failed')
    }
  }

  // ---------- variant generation ----------
  async function handleGenerate(e) {
    e?.preventDefault()
    if (!genCharId || genBusy) return
    setGenBusy(true)
    setGenError('')
    try {
      const { variants: fresh } = await generateVariant({
        characterId: genCharId,
        scene: genScene.trim(),
        numOutputs: genN
      })
      setVariants((list) => [...fresh, ...list])
    } catch (err) {
      // surface useful diagnostics from the function
      if (err.code === 'still_processing') {
        setGenError(t('ip.stillProcessing'))
      } else if (err.code === 'not_configured') {
        setGenError(err.message || t('ip.notConfigured'))
      } else {
        setGenError(err.message || t('ip.generationFailed'))
      }
    } finally {
      setGenBusy(false)
    }
  }

  async function removeVariant(v) {
    if (!confirm(t('ip.deleteVariantConfirm'))) return
    try {
      await deleteVariant(v.id)
      setVariants((list) => list.filter((x) => x.id !== v.id))
    } catch (err) {
      setError(err.message || 'delete failed')
    }
  }

  if (loading) {
    return <div className="page"><AdminBar /><Loading /></div>
  }

  return (
    <div className="page">
      <AdminBar />

      <div className="admin-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{t('ip.title')}</h1>
          <p className="page-subtitle" style={{ margin: '0.2rem 0 0' }}>
            {t('ip.subtitle')}
          </p>
        </div>
        <button
          className="btn"
          onClick={() => setCharForm({})}
          disabled={Boolean(charForm)}
        >
          + {t('ip.addCharacter')}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {/* ---------- character library ---------- */}
      <section className="detail-section">
        <h2>{t('ip.characters')}</h2>

        {charForm && (
          <CharacterForm
            key={charForm.id || 'new'}
            initial={charForm}
            onSave={saveCharacter}
            onCancel={() => setCharForm(null)}
          />
        )}

        {characters.length === 0 && !charForm && (
          <p className="muted">{t('ip.noCharacters')}</p>
        )}

        <div className="ip-char-grid">
          {characters.map((c) => (
            <div key={c.id} className="ip-char-card">
              {c.base_image_url ? (
                <img src={c.base_image_url} alt={c.name} className="ip-char-img" />
              ) : (
                <div className="ip-char-img placeholder">{c.name?.[0] || '?'}</div>
              )}
              <div className="ip-char-body">
                <strong>{c.name}</strong>
                {c.description && <p className="muted">{c.description}</p>}
                <div className="admin-row-actions" style={{ marginTop: 'auto' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCharForm(c)}>
                    {t('admin.edit')}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeCharacter(c)}>
                    {t('admin.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- generate ---------- */}
      <section className="detail-section">
        <h2>{t('ip.generate')}</h2>
        {characters.length === 0 ? (
          <p className="muted">{t('ip.addCharacterFirst')}</p>
        ) : (
          <form className="stack" onSubmit={handleGenerate} style={{ maxWidth: 640 }}>
            <div className="form-row">
              <label className="field" style={{ flex: 2 }}>
                <span>{t('ip.character')}</span>
                <select
                  value={genCharId}
                  onChange={(e) => setGenCharId(e.target.value)}
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('ip.numOutputs')}</span>
                <select value={genN} onChange={(e) => setGenN(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>{t('ip.scene')}</span>
              <input
                placeholder={t('ip.scenePlaceholder')}
                value={genScene}
                onChange={(e) => setGenScene(e.target.value)}
              />
            </label>

            {genError && <p className="auth-error">{genError}</p>}

            <button className="btn" type="submit" disabled={genBusy || !genCharId}>
              {genBusy ? t('ip.generating') : `✨ ${t('ip.generateButton')}`}
            </button>
          </form>
        )}
      </section>

      {/* ---------- variants gallery ---------- */}
      <section className="detail-section">
        <h2>{t('ip.variants')} <span className="muted" style={{ fontSize: '0.9rem' }}>({variants.length})</span></h2>
        {variants.length === 0 ? (
          <p className="muted">{t('ip.noVariants')}</p>
        ) : (
          <div className="ip-variant-grid">
            {variants.map((v) => {
              const char = characters.find((c) => c.id === v.character_id)
              return (
                <figure key={v.id} className="ip-variant">
                  <img src={v.image_url} alt={v.scene || char?.name} loading="lazy" />
                  <figcaption>
                    <strong>{char?.name || '—'}</strong>
                    {v.scene && <span className="muted"> · {v.scene}</span>}
                  </figcaption>
                  <div className="ip-variant-actions">
                    <a className="btn btn-ghost btn-sm" href={v.image_url} target="_blank" rel="noopener noreferrer">↗</a>
                    <button className="btn btn-danger btn-sm" onClick={() => removeVariant(v)}>
                      {t('admin.delete')}
                    </button>
                  </div>
                </figure>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------- inline character form (create + edit) ----------
function CharacterForm({ initial, onSave, onCancel }) {
  const { t } = useTranslation()
  const fileInput = useRef(null)

  const [name, setName] = useState(initial.name || '')
  const [description, setDescription] = useState(initial.description || '')
  const [basePrompt, setBasePrompt] = useState(initial.base_prompt || '')
  const [baseImageUrl, setBaseImageUrl] = useState(initial.base_image_url || '')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function pickFile(f) {
    setErr('')
    try {
      validateCharImage(f)
    } catch (e) {
      setErr(t(e.message))
      return
    }
    setFile(f)
    setBaseImageUrl(URL.createObjectURL(f))
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setErr(t('ip.nameRequired'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      let imageUrl = initial.base_image_url || ''
      if (file) {
        imageUrl = await uploadCharacterBaseImage(file, name)
      }
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        base_prompt: basePrompt.trim() || null,
        base_image_url: imageUrl || null
      })
    } catch (e2) {
      setErr(e2.message || 'save failed')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{
      padding: '1rem',
      background: 'var(--mist)',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius)',
      marginBottom: '1rem'
    }}>
      <h3 style={{ margin: 0 }}>
        {initial.id ? t('ip.editCharacter') : t('ip.newCharacter')}
      </h3>

      <div className="form-row">
        <div
          className={`logo-drop${baseImageUrl ? ' has-image' : ''}`}
          style={{ flex: '0 0 120px', height: 120 }}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
        >
          {baseImageUrl ? (
            <img src={baseImageUrl} alt="" className="logo-preview" />
          ) : (
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              {t('ip.uploadBase')}
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={CHAR_IMAGE_ACCEPT}
            hidden
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />
        </div>

        <div className="stack" style={{ flex: 1, gap: '0.5rem' }}>
          <label className="field">
            <span>{t('ip.name')} *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claudio"
              required
            />
          </label>
          <label className="field">
            <span>{t('ip.description')}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('ip.descriptionHint')}
            />
          </label>
        </div>
      </div>

      <label className="field">
        <span>{t('ip.basePrompt')}</span>
        <textarea
          rows={2}
          value={basePrompt}
          onChange={(e) => setBasePrompt(e.target.value)}
          placeholder={t('ip.basePromptHint')}
        />
      </label>

      {err && <p className="auth-error">{err}</p>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? t('admin.form.saving') : t('admin.form.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          {t('admin.cancel')}
        </button>
      </div>
    </form>
  )
}
