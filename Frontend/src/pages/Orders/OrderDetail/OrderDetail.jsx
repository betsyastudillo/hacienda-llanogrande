import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { ORDER_STATUS_STEPS } from '../../../constants/orderStatus'
import { CircleCheck, CircleX, Clock } from 'lucide-react'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatDate } from '../../../utils/formatDate'
import PaymentCard from './PaymentCard'
import './OrderDetail.css'

const API_BASE = api.defaults.baseURL

function StatusStepper({ currentStatus }) {
  const currentIndex = ORDER_STATUS_STEPS.findIndex((s) => s.key === currentStatus)
  const progressPercent = currentIndex <= 0 ? 0 : (currentIndex / (ORDER_STATUS_STEPS.length - 1)) * 100


  return (
    <div className="detail-stepper">
      <div className='detail-stepper-track'>
        <div className="detail-stepper-track-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {ORDER_STATUS_STEPS.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <div className="detail-stepper-step" key={step.key}>
            <div className="detail-stepper-line-wrapper">
              <div
                className={`detail-stepper-circle ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
              >
                {isDone ? '✓' : index + 1}
              </div>
            </div>
            <p className={`detail-stepper-label ${isCurrent ? 'is-current' : ''}`}>{step.label}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function OrderDetail() {
  const { orderId } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [products, setProducts] = useState([])
  const [payment, setPayment] = useState(null)
  const [bankAccount, setBankAccount] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [dispatchGuide, setDispatchGuide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchPayment() {
    try {
      const res = await api.get(`/payments/order/${orderId}`)
      setPayment(res.data)
      try {
        const bankRes = await api.get(`/bank-accounts/${res.data.bank_account_id}`)
        setBankAccount(bankRes.data)
      } catch {
        setBankAccount(null)
      }
    } catch {
      setPayment(null)
      setBankAccount(null)
    }
  }
  
  async function reloadPayment() {
    const orderRes = await api.get(`/orders/${orderId}`)
    setOrder(orderRes.data) // el estado del pedido cambia al confirmar el pago
    await fetchPayment()
  }

  useEffect(() => {
    async function fetchAll() {
      try {
        const [orderRes, productsRes] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get('/products/'),
        ])
        setOrder(orderRes.data)
        setProducts(productsRes.data)
      } catch (err) {
        setError('No se pudo cargar el pedido')
        setLoading(false)
        return
      }

      // Estas secciones son opcionales según el estado del pedido —
      try {
        await fetchPayment()
      } catch {
        setPayment(null)
      }

      try {
        const res = await api.get(`/assignments/order/${orderId}`)
        setAssignment(res.data)
      } catch {
        setAssignment(null)
      }

      try {
        const res = await api.get(`/dispatch-guides/order/${orderId}`)
        setDispatchGuide(res.data)
      } catch {
        setDispatchGuide(null)
      }

      setLoading(false)
    }

    fetchAll()

  }, [orderId])

  const getProduct = (productId) => products.find((m) => m.id === productId)

  if (loading) return <main className="detail-main"><p className="detail-empty">Cargando pedido...</p></main>
  if (error) return <main className="detail-main"><p className="detail-empty detail-error-text">{error}</p></main>
  if (!order) return null

  const ASSIGNMENT_STATUS_CONFIG = {
    approved: { label: 'Aprobado', icon: CircleCheck, className: 'is-accent' },
    rejected: { label: 'Rechazado', icon: CircleX, className: 'is-error' },
    pending: { label: 'Pendiente de validación', icon: Clock, className: '' },
  }
  return (
    <main className="detail-main">
      <button className="company-detail-back-btn" onClick={() => navigate('/orders')}>
        ← Volver a pedidos
      </button>
      <div className="detail-header">
        <div>
          <p className="detail-eyebrow">Pedido {order.order_number}</p>
          <p className="detail-eyebrow">Empresa:</p>
          <p className="detail-order-id">{order.company_display_name}</p>
          <p className="detail-order-date">Creado el {formatDate(order.created_at)}</p>
        </div>
      </div>

      <div className="detail-stepper-card">
        <div className='detail-stepper-wrapper'>
          <StatusStepper currentStatus={order.status} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <p className="detail-card-title">Productos</p>
          <div className='detail-items-table-wrapper'>
            <table className="detail-items-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const product = getProduct(item.product_id)
                  return (
                    <tr key={item.id}>
                      <td>{product?.name || 'Producto'}</td>
                      <td>{item.quantity_m3} {product?.unit}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td className="detail-line-total">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="detail-totals">
            <div className="detail-totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="detail-totals-row">
              <span>IVA</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            <div className="detail-totals-row detail-totals-final">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="detail-side-column">
          <PaymentCard
            order={order}
            payment={payment}
            bankAccount={bankAccount}
            onChanged={reloadPayment}
          />

          <div className="detail-card">
            <p className="detail-card-title">Transporte</p>
            {assignment ? (
              <div className="detail-info-list">
                {(() => {
                  const config = ASSIGNMENT_STATUS_CONFIG[assignment.validation_status] || ASSIGNMENT_STATUS_CONFIG.pending
                  const Icon = config.icon
                  return (
                    <div className="detail-info-row">
                      <span>Estado</span>
                      <span className={`detail-badge ${config.className}`}>
                        <Icon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                        {config.label}
                      </span>
                    </div>
                  )
                })()}
                {assignment.rejection_reason && (
                  <div className="detail-info-row">
                    <span>Motivo</span>
                    <span>{assignment.rejection_reason}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="detail-empty-inline">Aún no se ha enviado información de transporte.</p>
            )}
          </div>
          <div className="detail-card detail-qr-card">
            <p className="detail-card-title">Guía de despacho</p>
            {dispatchGuide ? (
              <>
                {dispatchGuide.qr_image_url && (
                  <img
                    src={`${API_BASE}${dispatchGuide.qr_image_url}`}
                    alt="Código QR de despacho"
                    className="detail-qr-image"
                  />
                )}
                <p className="detail-empty-inline" style={{ textAlign: 'center', marginTop: 8 }}>
                  {dispatchGuide.status === 'used' ? 'Ya utilizada' : 'Escanear en portería'}
                </p>
              </>
            ) : (
              <p className="detail-empty-inline">Aún no se ha generado la guía de despacho.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}