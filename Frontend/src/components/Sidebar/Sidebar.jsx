import { NavLink } from 'react-router-dom'
import './Sidebar.css'

export default function Sidebar({ isOpen }) {
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <nav className="sidebar-nav">
        <NavLink
          to="/orders"
          className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
        >
          Pedidos
        </NavLink>
        {/* Próximas pantallas se agregan aquí como otro NavLink */}
      </nav>
    </aside>
  )
}