import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import Modal from '../../../components/Modal/Modal'
import { ORDER_STATUS_STEPS } from '../../../constants/orderStatus'
import { useToast } from '../../../context/Toast/ToastContext'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { useAuth } from '../../../context/AuthContext'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatDate } from '../../../utils/formatDate'
import PaymentCard from './PaymentCard'
import InvoiceCard from './InvoiceCard'
import TransportCard from './TransportCard'
import './OrderDetail.css'
import { CircleCheck, CircleX } from 'lucide-react'

const API_BASE = api.defaults.baseURL

const CANCELLED_STEP = { key: 'cancelled', label: 'Anulado' }

function StatusStepper({ currentStatus }) {

  const isCancelled = currentStatus === 'cancelled'

  // Un pedido anulado solo puede llegar hasta 'creado' así que muestran esos dos pasos
  const steps = isCancelled ? [ORDER_STATUS_STEPS[0], CANCELLED_STEP] : ORDER_STATUS_STEPS

  const currentIndex = steps.findIndex((s) => s.key === currentStatus)
  const progressPercent = currentIndex <= 0 ? 0 : (currentIndex / (steps.length - 1)) * 100

  return (
    <div className={`detail-stepper ${isCancelled ? 'is-cancelled' : ''}`}>
      <div className='detail-stepper-track'>
        <div className="detail-stepper-track-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {steps.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        const symbol = isCancelled && isCurrent ? '✕' : isDone ? '✓' : index + 1

        return (
          <div className="detail-stepper-step" key={step.key}>
            <div className="detail-stepper-line-wrapper">
              <div
                className={`detail-stepper-circle ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
              >
                {symbol}
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
  const { hasPermission } = useAuth()

  const [order, setOrder] = useState(null)
  const [products, setProducts] = useState([])
  const [payment, setPayment] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [bankAccount, setBankAccount] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [dispatchGuide, setDispatchGuide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  
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
  
  async function fetchInvoice() {
    try {
      const res = await api.get(`/invoices/order/${orderId}`)
      setInvoice(res.data)
    } catch {
      setInvoice(null)  // 404 es normal: aún no hay factura
    }
  }

  async function fetchAssignment() {
    try {
      const res = await api.get(`/assignments/order/${orderId}`)
      setAssignment(res.data)
    } catch {
      setAssignment(null) 
    }
  }

  async function fetchDispatchGuide() {
    try {
      const res = await api.get(`/dispatch-guides/order/${orderId}`)
      setDispatchGuide(res.data)
    } catch {
      setDispatchGuide(null)
    }
  }

  async function reloadAll() {
    const orderRes = await api.get(`/orders/${orderId}`)
    setOrder(orderRes.data) // el estado del pedido cambia al confirmar el pago
    await Promise.all([fetchPayment(), fetchInvoice(), fetchAssignment(), fetchDispatchGuide()])
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

      // Estas secciones son opcionales según el estado del pedido — Se dejan sin try/catch porque cada una atrapa sus propios errores
      await Promise.all([fetchPayment(), fetchInvoice(), fetchAssignment(), fetchDispatchGuide()])
      setLoading(false)

    }

    fetchAll()

  }, [orderId])

  const getProduct = (productId) => products.find((m) => m.id === productId)

  const handleCancel = async () => {
    setCancelling(true)
    
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason: cancelReason.trim() })
      showToast('Pedido anulado.')
      setShowCancel(false)
      await reloadAll()
    } catch (err) {
      showToast(getErrorMessage(err, 'No se pudo anular el pedido'), 'error')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <main className="detail-main"><p className="detail-empty">Cargando pedido...</p></main>
  if (error) return <main className="detail-main"><p className="detail-empty detail-error-text">{error}</p></main>
  if (!order) return null

  const canCancel = hasPermission('order:anular') && order.status === 'created'

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
        {canCancel && (
          <button type="button" className="pay-btn is-danger" onClick={() => { setCancelReason(''); setShowCancel(true) }}>
            < CircleX />
          </button>
        )}
      </div>


      {showCancel && (
        <Modal title="Anular pedido" onClose={() => setShowCancel(false)}>
          <p className="detail-empty-inline">Se devolverá el inventario del pedido. <br />Esta acción no se puede deshacer.</p>
          <br />
          <label className="pay-label" htmlFor="cancel-reason">Motivo (obligatorio)</label>
          <textarea id="cancel-reason" className="pay-textarea" rows={3} value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)} />
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setShowCancel(false)} disabled={cancelling}>Cancelar</button>
            <button type="button" className="pay-btn is-primary" onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelling}>
              {cancelling ? 'Anulando...' : 'Anular pedido'}
            </button>
          </div>
        </Modal>
      )}

      <div className="detail-stepper-card">
        <div className='detail-stepper-wrapper'>
          <StatusStepper currentStatus={order.status} />
        </div>
      </div>

      { order.status === 'cancelled' && (
        <div className="detail-cancelled">
          <strong>Pedido anulado</strong> el {formatDate(order.cancelled_at)}
          <p>Motivo: {order.cancellation_reason}</p>
        </div>
      )}
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

        {order.status !== 'cancelled' && (
          <div className="detail-side-column">
            <PaymentCard
              order={order}
              payment={payment}
              bankAccount={bankAccount}
              onChanged={reloadAll}
            />
            
            <InvoiceCard order={order} invoice={invoice} onChanged={reloadAll}/>

            <TransportCard order={order} assignment={assignment} dispatchGuide={dispatchGuide} onChanged={reloadAll} />

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
        )}
      </div>
    </main>
  )
}