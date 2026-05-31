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
  generateLogos,
  setProjectLogo,
  CHAR_IMAGE_ACCEPT,
  validateCharImage
} from '../../lib/ipStudio'
import { getAllProjects } from '../../lib/adminQueries'

export default function IPStudio() {
  const { t } = useTranslation()

  // ---------- shared state ----------
  const [characters, setCharacters] = useState(null)
  const [variants, setVariants] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ---------- character form (null = closed, {} = create, row = edit) ----------
  const [charForm, setCharForm] = useState(null)

  // ---------- variant generation ----------
  const [genCharId, setGenCharId] = useState('')
  const [genScene, setGenScene] = useState('')
  const [genN, setGenN] = useState(2)
  const [genProvider, setGenProvider] = useState('replicate')
  const [genBusy, setGenBusy] = useState(false)
  const [genError, setGenError] = useState('')

  // ---------- logo generation ----------
  const [logoProjectId, setLogoProjectId] = useState('')
  const [logoPrompt, setLogoPrompt] = useState('')
  const [logoAspect, setLogoAspect] = useState('1:1')
  const [logoN, setLogoN] = useState(4)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [logoCandidates, setLogoCandidates] = useState([])
  const [logoSavedMsg, setLogoSavedMsg] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getCharacters(), getVariants(), getAllProjects()])
      .then(([c, v, p]) => {
        if (!active) return
        setCharacters(c)
        setVariants(v)
        setProjects(p)
        if (c.length > 0) setGenCharId((id) => id || c[0].id)
        if (p.length > 0) setLogoProjectId((id) => id || p[0].id)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'load failed')
        setLoading(false)
      })
    return () => { active = false }
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
  async function handleGenerateVariant(e) {
    e?.preventDefault()
    if (!genCharId || genBusy) return
    setGenBusy(true)
    setGenError('')
    try {
      const { variants: fresh } = await generateVariant({
        characterId: genCharId,
        scene: genScene.trim(),
        numOutputs: genN,
        provider: genProvider
      })
      setVariants((list) => [...fresh, ...list])
    } catch (err) {
      if (err.code === 'still_processing') setGenError(t('ip.stillProcessing'))
      else if (err.code === 'not_configured') setGenError(err.message || t('ip.notConfigured'))
      else setGenError(err.message || t('ip.generationFailed'))
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

  // ---------- logo generation ----------
  async function handleGenerateLogos(e) {
    e?.preventDefault()
    if (!logoProjectId || logoBusy) return
    setLogoBusy(true)
    setLogoError('')
    setLogoSavedMsg('')
    setLogoCandidates([])
    try {
      const { candidates } = await generateLogos({
        projectId: logoProjectId,
        prompt: logoPrompt.trim(),
        numOutputs: logoN,
        aspectRatio: logoAspect
      })
      setLogoCandidates(candidates || [])
    } catch (err) {
      if (err.code === 'not_configured') setLogoError(err.message || t('ip.logoNotConfigured'))
      else setLogoError(err.message || t('ip.logoFailed'))
    } finally {
      setLogoBusy(false)
    }
  }

  async function useLogo(candidate) {
    if (!logoProjectId) return
    setLogoError('')
    try {
      await setProjectLogo(logoProjectId, candidate.url)
      setProjects((ps) =>
        ps.map((p) => (p.id === logoProjectId ? { ...p, logo_url: candidate.url } : p))
      )
      const proj = projects.find((p) => p.id === logoProjectId)
      setLogoSavedMsg(t('ip.logoSaved', { name: proj?.name_en || proj?.name_zh || '' }))
      // keep candidates visible so user can pick another if they want
    } catch (err) {
      setLogoError(err.message || 'save failed')
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

      {/* ---------- generate variant ---------- */}
      <section className="detail-section">
        <h2>{t('ip.generate')}</h2>
        {characters.length === 0 ? (
          <p className="muted">{t('ip.addCharacterFirst')}</p>
        ) : (
          <form className="stack" onSubmit={handleGenerateVariant} style={{ maxWidth: 720 }}>
            <div className="form-row">
              <label className="field" style={{ flex: 2 }}>
                <span>{t('ip.character')}</span>
                <select value={genCharId} onChange={(e) => setGenCharId(e.target.value)}>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('ip.provider')}</span>
                <select value={genProvider} onChange={(e) => setGenProvider(e.target.value)}>
                  <option value="replicate">Replicate · Flux Redux</option>
                  <option value="stability">Stability · SD3.5 style</option>
                </select>
              </label>
              <label className="field">
                <span>{t('ip.numOutputs')}</span>
                <select value={genN} onChange={(e) => setGenN(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
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

      {/* ---------- generate logo (Stability) ---------- */}
      <section className="detail-section">
        <h2>{t('ip.logoStudio')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{t('ip.logoStudioHint')}</p>

        {projects.length === 0 ? (
          <p className="muted">{t('ip.noProjects')}</p>
        ) : (
          <form className="stack" onSubmit={handleGenerateLogos} style={{ maxWidth: 720 }}>
            <div className="form-row">
              <label className="field" style={{ flex: 2 }}>
                <span>{t('ip.targetProject')}</span>
                <select value={logoProjectId} onChange={(e) => setLogoProjectId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_en || p.name_zh || p.name_it || '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('ip.aspectRatio')}</span>
                <select value={logoAspect} onChange={(e) => setLogoAspect(e.target.value)}>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>
              </label>
              <label className="field">
                <span>{t('ip.numOutputs')}</span>
                <select value={logoN} onChange={(e) => setLogoN(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            <label className="field">
              <span>{t('ip.logoPrompt')}</span>
              <textarea
                rows={2}
                placeholder={t('ip.logoPromptHint')}
                value={logoPrompt}
                onChange={(e) => setLogoPrompt(e.target.value)}
              />
            </label>

            {logoError && <p className="auth-error">{logoError}</p>}
            {logoSavedMsg && <p className="muted" style={{ color: 'var(--accent)' }}>✓ {logoSavedMsg}</p>}

            <button className="btn" type="submit" disabled={logoBusy || !logoProjectId}>
              {logoBusy ? t('ip.generating') : `🎨 ${t('ip.generateLogos')}`}
            </button>
          </form>
        )}

        {logoCandidates.length > 0 && (
          <>
            <h3 style={{ marginTop: '1.5rem' }}>{t('ip.candidates')}</h3>
            <div className="ip-variant-grid">
              {logoCandidates.map((c, i) => (
                <figure key={i} className="ip-variant">
                  <img src={c.url} alt={`candidate ${i + 1}`} loading="lazy" />
                  <figcaption>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>{c.model}</span>
                  </figcaption>
                  <div className="ip-variant-actions">
                    <a className="btn btn-ghost btn-sm" href={c.url} target="_blank" rel="noopener noreferrer">↗</a>
                    <button className="btn btn-sm" onClick={() => useLogo(c)}>
                      ✓ {t('ip.useAsLogo')}
                    </button>
                  </div>
                </figure>
              ))}
            </div>
          </>
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
