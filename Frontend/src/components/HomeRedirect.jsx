import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ORDER_PERMISSIONS = ['order:ver_todos', 'order:ver_empresa', 'order:ver_propios']

export default function HomeRedirect() {
  const { hasPermission } = useAuth()

  if (ORDER_PERMISSIONS.some((p) => hasPermission(p))) return <Navigate to="/orders" replace />
  if (hasPermission('dispatch_guide:verificar')) return <Navigate to="/dispatch-guides/scan" replace />

  return <Navigate to="/login" replace />
}