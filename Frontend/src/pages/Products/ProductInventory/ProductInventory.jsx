import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Wrench } from 'lucide-react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { formatDate } from '../../../utils/formatDate'
import './ProductInventory.css'

const MOVEMENT_CONFIG = {
  entrada: { label: 'Entrada', icon: ArrowDown, className: 'is-entry' },
  salida: { label: 'Salida', icon: ArrowUp, className: 'is-exit' },
  ajuste: { label: 'Ajuste', icon: Wrench, className: 'is-adjust' },
}

export default function ProductInventory() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [product, setProduct] = useState(null)
  const [stock, setStock] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [movementType, setMovementType] = useState('entrada')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canManage = hasPermission('inventory:gestionar')

  const loadData = async () => {
    const [productRes, stockRes, movementsRes] = await Promise.all([
      api.get(`/products/${productId}`),
      api.get(`/inventory/products/${productId}/stock`),
      api.get(`/inventory/products/${productId}/movements`),
    ])
    setProduct(productRes.data)
    setStock(stockRes.data.current_stock)
    setMovements(movementsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [productId])

  const handleRegister = async () => {
    setError('')
    const qty = Number(quantity)

    if (!quantity || (movementType === 'ajuste' ? qty === 0 : qty <= 0) || !Number.isInteger(qty)) {
      setError('Ingresa una cantidad entera válida')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/inventory/movements', {
        product_id: productId,
        movement_type: movementType,
        quantity: qty,
        reason: reason || null,
      })
      setQuantity('')
      setReason('')
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar el movimiento')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="inventory-main"><p>Cargando...</p></main>

  return (
    <main className="inventory-main">
      <button className="inventory-back-btn" onClick={() => navigate('/products')}>
        ← Volver a productos
      </button>

      <h1 className="inventory-title">{product.name}</h1>
      <p className="inventory-subtitle">
        Stock disponible: <strong>{stock} {product.unit}</strong>
      </p>

      {canManage && (
        <div className="inventory-form-card">
          <p className="inventory-form-title">Registrar movimiento</p>

          {error && <div className="inventory-form-error">{error}</div>}

          <div className="inventory-form-row">
            <select
              className="inventory-form-select"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="entrada">Entrada (cosecha)</option>
              <option value="ajuste">Ajuste (+/-)</option>
            </select>

            <input
              type="number"
              step="1"
              className="inventory-form-input-qty"
              placeholder="Cantidad"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <input
            type="text"
            className="inventory-form-input-reason"
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <button
            type="button"
            className="inventory-form-submit-btn"
            onClick={handleRegister}
            disabled={submitting}
          >
            {submitting ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      )}

      <div className="inventory-history-card">
        <p className="inventory-form-title">Historial de movimientos</p>

        {movements.length === 0 ? (
          <p className="inventory-empty">Aún no hay movimientos registrados.</p>
        ) : (
          <div className="inventory-movements-list">
            {movements.map((m) => {
              const config = MOVEMENT_CONFIG[m.movement_type]
              const Icon = config.icon
              return (
                <div key={m.id} className="inventory-movement-row">
                  <span className={`inventory-movement-badge ${config.className}`}>
                    <Icon size={14} />
                    {config.label}
                  </span>
                  <span className="inventory-movement-qty">{m.quantity} {product.unit}</span>
                  <span className="inventory-movement-reason">{m.reason || '—'}</span>
                  <span className="inventory-movement-date">{formatDate(m.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}