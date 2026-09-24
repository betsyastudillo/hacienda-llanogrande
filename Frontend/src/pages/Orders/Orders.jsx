import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { STATUS_LABELS } from '../../constants/orderStatus'
import SearchInput from '../../components/SearchInput/SearchInput'
import { formatDate } from '../../utils/formatDate'
import { CirclePlus, Eye } from 'lucide-react'
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
  const [searchTerm, setSearchTerm] = useState('')

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

  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase()
    return (
      order.id.toLowerCase().includes(term) ||
      order.company_legal_name?.toLowerCase().includes(term) ||
      STATUS_LABELS[order.status]?.toLowerCase().includes(term)
    )
  })

  return (
      <main className="orders-main">
        <div className="orders-main-header">
          <h1 className="orders-title">Pedidos</h1>
          <div className='orders-header-actions'>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por empresa..."
            />
          {canCreate && (
            <button className='orders-create-btn' onClick={() => navigate('/orders/new')}>
              <CirclePlus size={18} />
              Nuevo
            </button>
          )}
          </div>
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
                  <th>Fecha</th>
                  <th>Cantidad de Productos</th>
                  <th>Estado</th>
                  <th className="orders-align-right">Total</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="orders-row"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="orders-align-right orders-total-cell">{formatCurrency(order.total)}</td>
                    <td className="orders-id-cell">
                      <Eye/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
  )
}