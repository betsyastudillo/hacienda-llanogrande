import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Wrench, CirclePlus } from 'lucide-react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import Modal from '../../../components/Modal/Modal'
import { ADJUSTMENT_CATEGORIES } from '../../../constants/inventoryReasons'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatDate, formatDateOnly } from '../../../utils/formatDate'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import './ProductInventory.css'

const MOVEMENT_CONFIG = {
  entrada: { label: 'Entrada', icon: ArrowDown, className: 'is-entry' },
  salida: { label: 'Salida', icon: ArrowUp, className: 'is-exit' },
  ajuste: { label: 'Ajuste', icon: Wrench, className: 'is-adjust' },
}

function KardexCard({ label, value, price, valueClass = '', sign = '', isFinal = false }) {
  const total = Math.abs(value) * price

  return (
    <div className={`inventory-kardex-item ${isFinal ? 'is-final' : ''}`}>
      <span className="inventory-kardex-label">{label}</span>
      <span className={`inventory-kardex-value ${valueClass}`}>{sign}{value}</span>
      <span className="inventory-kardex-total">{formatCurrency(total)}</span>
    </div>
  )
}

function todayISO() {
  // en-CA entrega el formato AAAA-MM-DD; se calcula en hora de Colombia, no en UTC
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

const PAGE_SIZE = 10

export default function ProductInventory() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { showToast } = useToast()
  const fail = (message) => showToast(message, 'error')

  const [product, setProduct] = useState(null)
  const [stock, setStock] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [movementType, setMovementType] = useState('entrada')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [kardexStart, setKardexStart] = useState(todayISO())
  const [kardexEnd, setKardexEnd] = useState(todayISO())
  const [kardex, setKardex] = useState(null)
  const [kardexLoading, setKardexLoading] = useState(false)

  const [page, setPage] = useState(1)

  const canManage = hasPermission('inventory:gestionar')
  const canAdjust = hasPermission('inventory:ajustar')

  const loadData = async () => {
    try {
      const [productRes, stockRes, movementsRes] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get(`/inventory/products/${productId}/stock`),
        api.get(`/inventory/products/${productId}/movements`),
      ])
      setProduct(productRes.data)
      setStock(stockRes.data.current_stock)
      setMovements(movementsRes.data)
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudo cargar el producto'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [productId])

  const loadKardex = async () => {
    setKardexLoading(true)
    try {
      const res = await api.get(`/inventory/products/${productId}/kardex`, {
        params: { start_date: kardexStart, end_date: kardexEnd },
      })

      setKardex(res.data)
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudo consultar el kardex'))
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
  }

  const handleClose = () => {
    resetForm()
    setShowModal(false)
  }

  const handleRegister = async () => {
    const qty = Number(quantity)

    if (!quantity || (movementType === 'ajuste' ? qty === 0 : qty <= 0) || !Number.isInteger(qty))
      return fail('Ingresa una cantidad entera válida')
    if (movementType === 'ajuste' && (!category || !reason))
      return fail('Los ajustes requieren categoría y motivo')

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
      showToast('Movimiento registrado.')
      await loadData()
      setPage(1)
      await loadKardex()
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudo registrar el movimiento'))
    } finally {
      setSubmitting(false)
    }
  }

  const categoryLabel = (value) =>
    ADJUSTMENT_CATEGORIES.find((c) => c.value === value)?.label || value

  if (loading) return <main className="inventory-main"><p>Cargando...</p></main>
  
  if (!product) return <main className="inventory-main"><p>No se pudo cargar el producto.</p></main>

  const totalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)   // por si la lista se acorta y la página ya no existe
  const firstIndex = (currentPage - 1) * PAGE_SIZE
  const pageMovements = movements.slice(firstIndex, firstIndex + PAGE_SIZE)

  return (
    <main className="inventory-main">
      <button className="inventory-back-btn" onClick={() => navigate('/inventory')}>
        ← Volver a inventario
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
          <button 
            type="button" 
            className="inventory-kardex-btn" 
            onClick={loadKardex} 
            disabled={kardexLoading || !kardexStart || !kardexEnd || kardexStart > kardexEnd}
          >
            {kardexLoading ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {kardex && (
          <>
            <p className="inventory-kardex-range-label">
              Del {formatDateOnly(kardex.start_date)} al {formatDateOnly(kardex.end_date)}
            </p>
            <p className="inventory-kardex-unit-note">
              Todas las cantidades están expresadas en {product.unit} · Precio: {formatCurrency(product.price)} / {product.unit}
            </p>
            <div className="inventory-kardex-grid">
              <KardexCard label="Saldo inicial" value={kardex.opening_balance} price={product.price} />
              <KardexCard label="Entradas" value={kardex.entries} price={product.price} valueClass="is-entry" sign="+" />
              <KardexCard label="Salidas" value={kardex.exits} price={product.price} valueClass="is-exit" sign="−" />
              <KardexCard label="Pérdida por daño" value={kardex.adjustments_damage} price={product.price} valueClass="is-exit" />
              <KardexCard label="Otros ajustes" value={kardex.adjustments_other} price={product.price} />
              <KardexCard label="Saldo final" value={kardex.closing_balance} price={product.price} isFinal />
            </div>
          </>
        )}
      </div>

      <div className="inventory-history-card">
        <p className="inventory-form-title">Historial de movimientos</p>

        {movements.length === 0 ? (
          <p className="inventory-empty">Aún no hay movimientos registrados.</p>
        ) : (
          <div className='inventory-movements-wrapper'>
            <div className="inventory-movements-list">
              <div className="inventory-movement-row inventory-movement-header">
                <span>Tipo</span>
                <span>Fecha</span>
                <span>Cantidad</span>
                <span>Motivo</span>
              </div>

              {pageMovements.map((m) => {
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

              {movements.length > PAGE_SIZE && (
                <div className="inventory-pagination">
                  <button type="button" className="inventory-page-btn" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>
                    ← Anterior
                  </button>

                  <span className="inventory-page-info">
                    {firstIndex + 1}–{Math.min(firstIndex + PAGE_SIZE, movements.length)} de {movements.length}
                  </span>

                  <button type="button" className="inventory-page-btn" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Siguiente →
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Registrar movimiento" onClose={handleClose}>
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