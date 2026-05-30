import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getProjectByIdAdmin, createProject, updateProject } from '../../lib/adminQueries'
import { uploadLogo, deleteLogoByUrl, validateLogo, ACCEPT_ATTR } from '../../lib/storage'
import { getVariants } from '../../lib/ipStudio'
import { translate } from '../../lib/translate'
import { Loading } from '../../components/Status'
import AdminBar from '../../components/AdminBar'

const CATEGORIES = ['education', 'cultural', 'community', 'tools', 'other']
const LANGS = ['zh', 'it', 'en']

const EMPTY = {
  name_zh: '', name_it: '', name_en: '',
  tagline_zh: '', tagline_it: '', tagline_en: '',
  description_zh: '', description_it: '', description_en: '',
  category: 'other',
  external_url: '',
  tech_stack: '',     // comma-separated in the form
  screenshots: '',    // one URL per line in the form
  is_published: true,
  logo_url: '',
  mascot_variant_id: '' // optional FK → ct_ip_variants
}

export default function ProjectForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileInput = useRef(null)

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mascotVariants, setMascotVariants] = useState([])
  // Which language group is currently auto-translating, '' if none.
  const [translating, setTranslating] = useState('')

  // logo state
  const [logoFile, setLogoFile] = useState(null)        // newly chosen File
  const [logoPreview, setLogoPreview] = useState('')    // object URL or existing URL
  const [dragOver, setDragOver] = useState(false)

  // Load existing project when editing.
  useEffect(() => {
    if (!isEdit) return
    let active = true
    getProjectByIdAdmin(id)
      .then((p) => {
        if (!active) return
        setForm({
          ...EMPTY,
          ...p,
          tech_stack: Array.isArray(p.tech_stack) ? p.tech_stack.join(', ') : '',
          screenshots: Array.isArray(p.screenshots) ? p.screenshots.join('\n') : '',
          logo_url: p.logo_url || ''
        })
        setLogoPreview(p.logo_url || '')
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'load failed')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, isEdit])

  // Load IP Studio variants so admin can pick one as the project's mascot.
  useEffect(() => {
    let active = true
    getVariants().then((v) => active && setMascotVariants(v)).catch(() => {})
    return () => { active = false }
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // Auto-translate one language group (name / tagline / description) from the
  // most-filled-in field into the other two. Source = field with longest
  // non-whitespace content; targets = the remaining language codes.
  async function translateGroup(base) {
    const candidates = ['zh', 'it', 'en']
      .map((lng) => ({ lng, text: (form[`${base}_${lng}`] || '').trim() }))
      .filter((c) => c.text.length > 0)
      .sort((a, b) => b.text.length - a.text.length)
    if (candidates.length === 0) {
      setError(t('admin.form.translateEmpty'))
      return
    }
    const source = candidates[0]
    const targets = ['zh', 'it', 'en'].filter((l) => l !== source.lng)

    setTranslating(base)
    setError('')
    try {
      const result = await translate(source.text, source.lng, targets)
      setForm((f) => {
        const next = { ...f }
        for (const [lng, tx] of Object.entries(result)) {
          if (tx) next[`${base}_${lng}`] = tx
        }
        return next
      })
    } catch (err) {
      setError(err.message || 'translate failed')
    } finally {
      setTranslating('')
    }
  }

  function pickFile(file) {
    setError('')
    try {
      validateLogo(file)
    } catch (err) {
      setError(t(err.message)) // err.message is an i18n key (upload.*)
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) pickFile(file)
  }

  // Hard ceiling on the whole save chain (upload + DB write + cleanup). Real
  // saves complete in well under a second; anything past 20s is a stuck
  // request and we want the button back, not a forever spinner.
  function withTimeout(promise, ms = 20000, label = 'save') {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
      )
    ])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.external_url.trim()) {
      setError(t('admin.form.urlRequired'))
      return
    }
    setSaving(true)
    const oldLogoUrl = form.logo_url

    try {
      let logoUrl = form.logo_url
      if (logoFile) {
        logoUrl = await withTimeout(
          uploadLogo(logoFile, form.name_en || form.name_zh || 'logo'),
          30000,
          'upload'
        )
      }

      const payload = {
        name_zh: form.name_zh, name_it: form.name_it, name_en: form.name_en,
        tagline_zh: form.tagline_zh, tagline_it: form.tagline_it, tagline_en: form.tagline_en,
        description_zh: form.description_zh, description_it: form.description_it, description_en: form.description_en,
        category: form.category,
        external_url: form.external_url.trim(),
        logo_url: logoUrl || null,
        tech_stack: form.tech_stack.split(',').map((s) => s.trim()).filter(Boolean),
        screenshots: form.screenshots.split('\n').map((s) => s.trim()).filter(Boolean),
        is_published: form.is_published,
        mascot_variant_id: form.mascot_variant_id || null
      }

      if (isEdit) {
        await withTimeout(updateProject(id, payload), 20000, 'save')
      } else {
        await withTimeout(
          createProject({ ...payload, sort_order: 999 }),
          20000,
          'save'
        )
      }

      // Replaced the logo? Remove the old file (best-effort, after save succeeds).
      // Wrapped in its own short race so a hung cleanup can't block navigation.
      if (logoFile && oldLogoUrl && oldLogoUrl !== logoUrl) {
        try {
          await withTimeout(deleteLogoByUrl(oldLogoUrl), 5000, 'cleanup')
        } catch {
          /* old file lingering in storage is harmless */
        }
      }

      navigate('/admin', { replace: true })
    } catch (err) {
      const msg = err?.message || String(err)
      if (msg === 'save_timeout') setError(t('admin.form.saveTimeout'))
      else if (msg === 'upload_timeout') setError(t('admin.form.uploadTimeout'))
      else setError(msg)
    } finally {
      // Always release the button. Without this, success → navigate but a
      // surprise error path could leave the form spinning indefinitely.
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><AdminBar /><Loading /></div>

  return (
    <div className="page">
      <AdminBar />
      <h1 className="page-title">{isEdit ? t('admin.form.editTitle') : t('admin.form.addTitle')}</h1>

      <form className="stack admin-form" onSubmit={handleSubmit}>
        {/* logo upload */}
        <div className="field">
          <span>{t('admin.form.logo')}</span>
          <div
            className={`logo-drop${dragOver ? ' over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="logo preview" className="logo-preview" />
            ) : (
              <span className="muted">{t('admin.form.logoHint')}</span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT_ATTR}
              hidden
              onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
            />
          </div>
          {logoPreview && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.4rem', alignSelf: 'flex-start' }}
              onClick={() => { setLogoFile(null); setLogoPreview(''); set('logo_url', '') }}
            >
              {t('admin.form.removeLogo')}
            </button>
          )}
        </div>

        {/* trilingual name / tagline / description */}
        {[
          { base: 'name', el: 'input' },
          { base: 'tagline', el: 'input' },
          { base: 'description', el: 'textarea' }
        ].map(({ base, el }) => (
          <fieldset className="lang-group" key={base}>
            <legend>
              {t(`admin.form.${base}`)}
              <button
                type="button"
                className="btn btn-ghost btn-sm translate-btn"
                onClick={() => translateGroup(base)}
                disabled={Boolean(translating)}
                title={t('admin.form.translateHint')}
              >
                🌐 {translating === base ? t('admin.form.translating') : t('admin.form.translate')}
              </button>
            </legend>
            {LANGS.map((lng) => (
              <label className="field" key={lng}>
                <span>{lng.toUpperCase()}</span>
                {el === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={form[`${base}_${lng}`]}
                    onChange={(e) => set(`${base}_${lng}`, e.target.value)}
                  />
                ) : (
                  <input
                    value={form[`${base}_${lng}`]}
                    onChange={(e) => set(`${base}_${lng}`, e.target.value)}
                  />
                )}
              </label>
            ))}
          </fieldset>
        ))}

        <div className="form-row">
          <label className="field">
            <span>{t('admin.form.category')}</span>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`categories.${c}`)}</option>
              ))}
            </select>
          </label>

          <label className="field" style={{ flex: 2 }}>
            <span>{t('admin.form.url')} *</span>
            <input
              type="url"
              placeholder="https://…"
              value={form.external_url}
              onChange={(e) => set('external_url', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>{t('admin.form.techStack')}</span>
          <input
            placeholder="React, Vite, Supabase"
            value={form.tech_stack}
            onChange={(e) => set('tech_stack', e.target.value)}
          />
        </label>

        <label className="field">
          <span>{t('admin.form.screenshots')}</span>
          <textarea
            rows={3}
            placeholder={'https://…/shot1.png\nhttps://…/shot2.png'}
            value={form.screenshots}
            onChange={(e) => set('screenshots', e.target.value)}
          />
        </label>

        {mascotVariants.length > 0 && (
          <fieldset className="lang-group">
            <legend>{t('admin.form.mascotVariant')}</legend>
            <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
              {t('admin.form.mascotVariantHint')}
            </p>
            <div className="mvp-grid">
              <button
                type="button"
                className={`mvp-tile${!form.mascot_variant_id ? ' active' : ''}`}
                onClick={() => set('mascot_variant_id', '')}
              >
                <img src="/mascots/claudio.png" alt="" />
                <span>{t('admin.form.defaultMascot')}</span>
              </button>
              {mascotVariants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`mvp-tile${form.mascot_variant_id === v.id ? ' active' : ''}`}
                  onClick={() => set('mascot_variant_id', v.id)}
                  title={v.scene || ''}
                >
                  <img src={v.image_url} alt="" loading="lazy" />
                  <span>{v.scene || '—'}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => set('is_published', e.target.checked)}
          />
          <span>{t('admin.form.published')}</span>
        </label>

        {error && <p className="auth-error">{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? t('admin.form.saving') : t('admin.form.save')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin')}>
            {t('admin.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
