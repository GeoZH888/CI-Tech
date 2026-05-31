import { useTranslation } from 'react-i18next'

// Minimal site footer. Sticks to the bottom of the public pages.
export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <span>© {year} CI-WORLD · {t('app.tagline')}</span>
      <a href="https://github.com/GeoZH888/CI-WORLD" target="_blank" rel="noopener noreferrer">
        GitHub ↗
      </a>
    </footer>
  )
}
