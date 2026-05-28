import { Link } from 'react-router-dom'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true">⚡</span>
        <span>CI-Tech</span>
      </Link>
      <LanguageSwitcher />
    </header>
  )
}
