import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="layout">
      <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      <div className="layout-body">
        <Sidebar isOpen={sidebarOpen} />
        <div className="layout-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}