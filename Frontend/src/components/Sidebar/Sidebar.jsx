import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MENU_ITEMS } from '../../constants/menu'
import './Sidebar.css'

export default function Sidebar({ isOpen }) {
  const { hasPermission } = useAuth()

  // Items visibles para el sidebar (depende de los menús que puede ver el perfil asignado)
  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            {item.label}
        </NavLink>
        ))}
        {/* Próximas pantallas se agregan aquí como otro NavLink */}
      </nav>
    </aside>
  )
}