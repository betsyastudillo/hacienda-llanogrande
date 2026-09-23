import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { STATUS_LABELS } from '../../constants/orderStatus'
import './Orders.css'

function StatusBadge({ status }) {
  const isFinal = status === 'dispatched' || status === 'facturado'
  return (
    <span className={`status-badge ${isFinal ? 'status-badge-accent' : ''}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('order:crear')

  const { user, logout } = useAuth()

  const navigate = useNavigate()


  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await api.get('/orders/')

        setOrders(response.data)
      } catch (err) {
        setError('No se pudieron cargar los pedidos')
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  
  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

  const formatDate = (value) =>
    new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })


  return (
      <main className="orders-main">
        <div className="orders-main-header">
          <h1 className="orders-title">Pedidos</h1>
          {canCreate && (
            <button className='orders-create-btn' onClick={() => navigate('/orders/new')}>
              Crear pedido
            </button>
          )}
        </div>

        {loading && <p className="orders-empty">Cargando pedidos...</p>}
        {error && <p className="orders-empty orders-error-text">{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <p className="orders-empty">Todavía no hay pedidos registrados.</p>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="orders-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Cantidad de Productos</th>
                  <th>Estado</th>
                  <th className="orders-align-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="orders-row"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="orders-id-cell">Ver detalle</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="orders-align-right orders-total-cell">{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
  )
}