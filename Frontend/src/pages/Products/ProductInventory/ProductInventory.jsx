import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Wrench, CirclePlus } from 'lucide-react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { formatDate } from '../../../utils/formatDate'
import Modal from '../../../components/Modal/Modal'
import { ADJUSTMENT_CATEGORIES } from '../../../constants/inventoryReasons'
import './ProductInventory.css'

const MOVEMENT_CONFIG = {
  entrada: { label: 'Entrada', icon: ArrowDown, className: 'is-entry' },
  salida: { label: 'Salida', icon: ArrowUp, className: 'is-exit' },
  ajuste: { label: 'Ajuste', icon: Wrench, className: 'is-adjust' },
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ProductInventory() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [product, setProduct] = useState(null)
  const [stock, setStock] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [movementType, setMovementType] = useState('entrada')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [kardexStart, setKardexStart] = useState(todayISO())
  const [kardexEnd, setKardexEnd] = useState(todayISO())
  const [kardex, setKardex] = useState(null)
  const [kardexError, setKardexError] = useState('')
  const [kardexLoading, setKardexLoading] = useState(false)

  const canManage = hasPermission('inventory:gestionar')
  const canAdjust = hasPermission('inventory:ajustar')

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

  const loadKardex = async () => {
    setKardexError('')
    setKardexLoading(true)
    try {
      const res = await api.get(`/inventory/products/${productId}/kardex`, {
        params: { start_date: kardexStart, end_date: kardexEnd },
      })
      setKardex(res.data)
    } catch (err) {
      setKardexError(err.response?.data?.detail || 'No se pudo consultar el kardex')
      setKardex(null)
    } finally {
      setKardexLoading(false)
    }
  }

  useEffect(() => {
    loadKardex()
  }, [productId])

  const resetForm = () => {
    setMovementType('entrada')
    setQuantity('')
    setReason('')
    setCategory('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    setShowModal(false)
  }

  const handleRegister = async () => {
    setError('')
    const qty = Number(quantity)

    if (!quantity || (movementType === 'ajuste' ? qty === 0 : qty <= 0) || !Number.isInteger(qty)) {
      setError('Ingresa una cantidad entera válida')
      return
    }

    if (movementType === 'ajuste' && (!category || !reason)) {
      setError('Los ajustes requieren categoría y motivo')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/inventory/movements', {
        product_id: productId,
        movement_type: movementType,
        quantity: qty,
        reason: reason || null,
        category: movementType === 'ajuste' ? category : null,
      })
      handleClose()
      await loadData()
      await loadKardex()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar el movimiento')
    } finally {
      setSubmitting(false)
    }
  }

  const categoryLabel = (value) =>
    ADJUSTMENT_CATEGORIES.find((c) => c.value === value)?.label || value

  if (loading) return <main className="inventory-main"><p>Cargando...</p></main>

  return (
    <main className="inventory-main">
      <button className="inventory-back-btn" onClick={() => navigate('/products')}>
        ← Volver a productos
      </button>
      <div className='inventory-header-block'>
        <div className='inventory-title-center'>
          <h1 className="inventory-title">{product.name}</h1>
          <p className="inventory-subtitle">
            Stock disponible: <strong>{stock} {product.unit}</strong>
          </p>
        </div>

        {canManage && (
          <div className='inventory-header-actions'>
            <button
              type="button"
              className="inventory-list-create-btn"
              onClick={() => setShowModal(true)}
            >
              <CirclePlus size={18} />
              Nuevo movimiento
            </button>
          </div>
        )}
      </div>

      <div className="inventory-history-card">
        <p className="inventory-form-title">Kardex por período</p>

        <div className="inventory-kardex-filters">
          <input
            type="date"
            className="inventory-form-select"
            value={kardexStart}
            onChange={(e) => setKardexStart(e.target.value)}
          />
          <span className="inventory-kardex-sep">a</span>
          <input
            type="date"
            className="inventory-form-select"
            value={kardexEnd}
            onChange={(e) => setKardexEnd(e.target.value)}
          />
          <button type="button" className="inventory-kardex-btn" onClick={loadKardex} disabled={kardexLoading}>
            {kardexLoading ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {kardexError && <div className="inventory-form-error">{kardexError}</div>}

        {kardex && (
          <div className="inventory-kardex-grid">
            <div className="inventory-kardex-item">
              <span className="inventory-kardex-label">Saldo inicial</span>
              <span className="inventory-kardex-value">{kardex.opening_balance} {product.unit}</span>
            </div>
            <div className="inventory-kardex-item">
              <span className="inventory-kardex-label">Entradas</span>
              <span className="inventory-kardex-value is-entry">+{kardex.entries} {product.unit}</span>
            </div>
            <div className="inventory-kardex-item">
              <span className="inventory-kardex-label">Salidas</span>
              <span className="inventory-kardex-value is-exit">−{kardex.exits} {product.unit}</span>
            </div>
            <div className="inventory-kardex-item">
              <span className="inventory-kardex-label">Pérdida por daño</span>
              <span className="inventory-kardex-value is-exit">{kardex.adjustments_damage} {product.unit}</span>
            </div>
            <div className="inventory-kardex-item">
              <span className="inventory-kardex-label">Otros ajustes</span>
              <span className="inventory-kardex-value">{kardex.adjustments_other} {product.unit}</span>
            </div>
            <div className="inventory-kardex-item is-final">
              <span className="inventory-kardex-label">Saldo final</span>
              <span className="inventory-kardex-value">{kardex.closing_balance} {product.unit}</span>
            </div>
          </div>
        )}
      </div>

      <div className="inventory-history-card">
        <p className="inventory-form-title">Historial de movimientos</p>

        {movements.length === 0 ? (
          <p className="inventory-empty">Aún no hay movimientos registrados.</p>
        ) : (
          <div className="inventory-movements-list">
            <div className="inventory-movement-row inventory-movement-header">
              <span>Tipo</span>
              <span>Fecha</span>
              <span>Cantidad</span>
              <span>Motivo</span>
            </div>

            {movements.map((m) => {
              const config = MOVEMENT_CONFIG[m.movement_type]
              const Icon = config.icon
              return (
                <div key={m.id} className="inventory-movement-row">
                  <span className={`inventory-movement-badge ${config.className}`}>
                    <Icon size={14} />
                    {config.label}
                  </span>
                  <span className="inventory-movement-date">{formatDate(m.created_at)}</span>
                  <span className="inventory-movement-qty">{m.quantity} {product.unit}</span>
                  <span className="inventory-movement-reason">
                    {m.category ? `${categoryLabel(m.category)} — ` : ''}{m.reason || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Registrar movimiento" onClose={handleClose}>
        {error && <div className="inventory-form-error">{error}</div>}

        <div className="modal-field">
          <label className="modal-field-label">Tipo de movimiento</label>
          <select
            className="reason-picker-select"
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value)
              setCategory('')
            }}
          >
            <option value="entrada">Entrada (cosecha)</option>
            {canAdjust && <option value="ajuste">Ajuste (+/-)</option>}
          </select>
        </div>

        <div className="modal-field">
          <label className="modal-field-label">Cantidad</label>
          <input
            type="number"
            step="1"
            className="reason-picker-input"
            placeholder="Cantidad"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        {movementType === 'ajuste' && (
          <div className="modal-field">
            <label className="modal-field-label">Categoría</label>
            <select
              className="reason-picker-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Selecciona una categoría</option>
              {ADJUSTMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="modal-field">
          <label className="modal-field-label">Motivo</label>
          <input
            type="text"
            className="reason-picker-input"
            placeholder={movementType === 'ajuste' ? 'Obligatorio' : 'Opcional'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="inventory-form-submit-btn modal-submit-full"
          onClick={handleRegister}
          disabled={submitting}
        >
          {submitting ? 'Registrando...' : 'Guardar'}
        </button>
      </Modal>
      )}
    </main>
  )
}