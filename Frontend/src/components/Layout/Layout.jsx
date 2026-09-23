import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

export default function Layout() {
  // Responsividad, no abre el sidebar si está en vista mobile
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width: 768px)').matches
  )

  return (
    <div className="layout">
      <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      <div className="layout-body">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="layout-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}