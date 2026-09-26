import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import SearchInput from '../../components/SearchInput/SearchInput'
import { formatDate } from '../../utils/formatDate'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import { STATUS_LABELS, STATUS_COLORS, STATUS_ICONS } from '../../constants/orderStatus'
import StatusHelpPopover from '../../components/StatusHelpPopover/StatusHelpPopover'
import { CirclePlus, Eye } from 'lucide-react'
import './Orders.css'


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
      order.company_display_name?.toLowerCase().includes(term) ||
      STATUS_LABELS[order.status]?.toLowerCase().includes(term)
    )
  })

  
  return (
      <main className="orders-main">
        <div className="orders-main-header">
          <h1 className="orders-title">Pedidos</h1>
          {canCreate && (
            <button className='orders-create-btn' onClick={() => navigate('/orders/new')}>
              <CirclePlus size={18} />
              Nuevo
            </button>
          )}
          </div>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por empresa..."
            />
          {/* </div> */}

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
                  <th>Empresa</th>
                  <th>Fecha</th>
                  <th>Q.</th>
                  <th><StatusHelpPopover /></th>
                  <th className="orders-align-right">Total</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const colors = STATUS_COLORS[order.status] || { bg: '#ece9e2', text: '#5f5e5a' }
                  
                  return(
                  <tr
                    key={order.id}
                    className="orders-row"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td>{order.company_display_name}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.items.length}</td>
                    <td>
                      <StatusBadge
                        label={STATUS_LABELS[order.status] || order.status}
                        bgColor={colors.bg}
                        textColor={colors.text}
                        icon={STATUS_ICONS[order.status]}
                      />
                    </td>
                    <td className="orders-align-right orders-total-cell">{formatCurrency(order.total)}</td>
                    <td className="orders-id-cell">
                      <Eye/>
                    </td>
                  </tr>
                  )  
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
  )
}