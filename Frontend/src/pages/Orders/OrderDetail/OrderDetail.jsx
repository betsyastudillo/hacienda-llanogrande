import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../../services/api'
import { ORDER_STATUS_STEPS, STATUS_LABELS } from '../../../constants/orderStatus'
import './OrderDetail.css'

const API_BASE = 'http://localhost:8000'

function StatusStepper({ currentStatus }) {
  const currentIndex = ORDER_STATUS_STEPS.findIndex((s) => s.key === currentStatus)

  return (
    <div className="detail-stepper">
      {ORDER_STATUS_STEPS.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={step.key} className="detail-stepper-step">
            <div className="detail-stepper-line-wrapper">
              <div
                className={`detail-stepper-circle ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
              >
                {isDone ? '✓' : index + 1}
              </div>
              {index < ORDER_STATUS_STEPS.length - 1 && (
                <div className={`detail-stepper-connector ${isDone ? 'is-done' : ''}`} />
              )}
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

  const [order, setOrder] = useState(null)
  const [materials, setMaterials] = useState([])
  const [payment, setPayment] = useState(null)
  const [bankAccount, setBankAccount] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [dispatchGuide, setDispatchGuide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchAll() {
      try {
        const [orderRes, materialsRes] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get('/materials/'),
        ])
        setOrder(orderRes.data)
        setMaterials(materialsRes.data)
      } catch (err) {
        setError('No se pudo cargar el pedido')
        setLoading(false)
        return
      }

      // Estas secciones son opcionales según el estado del pedido —
      // un 404 aquí es normal ("aún no existe"), no un error real.
      try {
        const res = await api.get(`/payments/order/${orderId}`)
        setPayment(res.data)
        try {
          const bankRes = await api.get(`/bank-accounts/${res.data.bank_account_id}`)
          setBankAccount(bankRes.data)
        } catch {
          // sin acceso o no encontrada, se omite
        }
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

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

  const formatDate = (value) =>
    new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const getMaterial = (materialId) => materials.find((m) => m.id === materialId)

  if (loading) return <main className="detail-main"><p className="detail-empty">Cargando pedido...</p></main>
  if (error) return <main className="detail-main"><p className="detail-empty detail-error-text">{error}</p></main>
  if (!order) return null

  return (
    <main className="detail-main">
      <div className="detail-header">
        <div>
          <p className="detail-eyebrow">Pedido</p>
          <p className="detail-order-id">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="detail-order-date">Creado el {formatDate(order.created_at)}</p>
        </div>
      </div>

      <div className="detail-stepper-card">
        <StatusStepper currentStatus={order.status} />
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <p className="detail-card-title">Productos</p>
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
                const material = getMaterial(item.material_id)
                return (
                  <tr key={item.id}>
                    <td>{material?.name || 'Producto'}</td>
                    <td>{item.quantity_m3} {material?.unit}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td className="detail-line-total">{formatCurrency(item.subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

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
          <div className="detail-card">
            <p className="detail-card-title">Pago</p>
            {payment ? (
              <div className="detail-info-list">
                <div className="detail-info-row">
                  <span>Referencia</span>
                  <span>{payment.proforma_number}</span>
                </div>
                <div className="detail-info-row">
                  <span>Estado</span>
                  <span className={`detail-badge ${payment.status === 'confirmed' ? 'is-accent' : ''}`}>
                    {payment.status === 'confirmed' ? 'Confirmado' : payment.status === 'failed' ? 'Fallido' : 'Pendiente'}
                  </span>
                </div>
                {bankAccount && (
                  <>
                    <div className="detail-info-row">
                      <span>Banco</span>
                      <span>{bankAccount.bank_name}</span>
                    </div>
                    <div className="detail-info-row">
                      <span>Cuenta</span>
                      <span>{bankAccount.account_number}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="detail-empty-inline">Aún no se ha generado la proforma de pago.</p>
            )}
          </div>

          <div className="detail-card">
            <p className="detail-card-title">Transporte</p>
            {assignment ? (
              <div className="detail-info-list">
                <div className="detail-info-row">
                  <span>Estado</span>
                  <span
                    className={`detail-badge ${
                      assignment.validation_status === 'approved'
                        ? 'is-accent'
                        : assignment.validation_status === 'rejected'
                        ? 'is-error'
                        : ''
                    }`}
                  >
                    {assignment.validation_status === 'approved'
                      ? 'Aprobado'
                      : assignment.validation_status === 'rejected'
                      ? 'Rechazado'
                      : 'Pendiente de validación'}
                  </span>
                </div>
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