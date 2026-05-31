import { Link } from 'react-router-dom'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <img
          src="/ci-world-logo.png"
          alt=""
          aria-hidden="true"
          className="brand-logo"
        />
        <span>CI-WORLD</span>
      </Link>
      <LanguageSwitcher />
    </header>
  )
}
