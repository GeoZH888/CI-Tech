import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Mascot from './components/Mascot'
import Home from './pages/Home'
import ProjectDetail from './pages/ProjectDetail'
import Login from './pages/admin/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import ProjectForm from './pages/admin/ProjectForm'
import IPStudio from './pages/admin/IPStudio'
import RequireSuperAdmin from './components/RequireSuperAdmin'

// Maps the current path to a mascot tip key (trilingual, from i18n mascot.tips.*).
function tipKeyForPath(pathname) {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/project/')) return 'detail'
  if (pathname.startsWith('/admin/login')) return 'login'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'home'
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:id" element={<ProjectDetail />} />

        {/* Auth + Super Admin */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>}
        />
        <Route
          path="/admin/new"
          element={<RequireSuperAdmin><ProjectForm /></RequireSuperAdmin>}
        />
        <Route
          path="/admin/edit/:id"
          element={<RequireSuperAdmin><ProjectForm /></RequireSuperAdmin>}
        />
        <Route
          path="/admin/ip-studio"
          element={<RequireSuperAdmin><IPStudio /></RequireSuperAdmin>}
        />

        <Route path="*" element={<Home />} />
      </Routes>
      <Mascot tipKey={tipKeyForPath(pathname)} />
    </div>
  )
}
