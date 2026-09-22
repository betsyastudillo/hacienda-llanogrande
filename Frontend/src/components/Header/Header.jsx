import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/logo-blaco.png'
import './Header.css'

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button className="sidebar-toggle-btn" onClick={onToggleSidebar} aria-label="Abrir/cerrar menú">
          <span className="sidebar-toggle-bar"></span>
          <span className="sidebar-toggle-bar"></span>
          <span className="sidebar-toggle-bar"></span>
        </button>

        <div className="app-header-brand">
          <img src={logo} alt="AridosCo" className="app-header-logo-img" />
          <span className="app-header-brand-name">Bienvenido a Hacienda Llanogrande, <span className="app-header-user-role">{user?.role}</span></span>
        </div>
      </div>

      <div className="app-header-right">
        <button className="app-header-logout-btn" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}