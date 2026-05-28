import { Link } from 'react-router-dom'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <img
          src="/ci-tech-logo.png"
          alt=""
          aria-hidden="true"
          className="brand-logo"
        />
        <span>CI-Tech</span>
      </Link>
      <LanguageSwitcher />
    </header>
  )
}
