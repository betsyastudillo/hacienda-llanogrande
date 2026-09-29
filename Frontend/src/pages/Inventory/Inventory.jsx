import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, CirclePlus } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import SearchInput from '../../components/SearchInput/SearchInput'
import Modal from '../../components/Modal/Modal'
import { ADJUSTMENT_CATEGORIES } from '../../constants/inventoryReasons'
import './Inventory.css'

export default function Inventory() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [products, setProducts] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [movementType, setMovementType] = useState('entrada')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canManage = hasPermission('inventory:gestionar')
  const canAdjust = hasPermission('inventory:ajustar')

  const loadData = async () => {
    const res = await api.get('/products/')
    const baseProducts = res.data.filter((p) => !p.parent_product_id)
    setProducts(baseProducts)

    const stockEntries = await Promise.all(
      baseProducts.map(async (p) => {
        try {
          const stockRes = await api.get(`/inventory/products/${p.id}/stock`)
          return [p.id, stockRes.data.current_stock]
        } catch {
          return [p.id, null]
        }
      })
    )
    setStockByProduct(Object.fromEntries(stockEntries))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetForm = () => {
    setSelectedProductId('')
    setMovementType('entrada')
    setQuantity('')
    setCategory('')
    setReason('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    setShowModal(false)
  }

  const handleRegister = async () => {
    setError('')
    const qty = Number(quantity)

    if (!selectedProductId) {
      setError('Selecciona un producto')
      return
    }
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
      const response = await api.post('/inventory/movements', {
        product_id: selectedProductId,
        movement_type: movementType,
        quantity: qty,
        reason: reason || null,
        category: movementType === 'ajuste' ? category : null,
      })
      console.log(response)
      handleClose()
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar el movimiento')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="inventory-list-main">
      <div className="inventory-list-header">
        <h1 className="inventory-list-title">Inventario</h1>
        {canManage && (
          <button
            type="button"
            className="inventory-list-create-btn"
            onClick={() => setShowModal(true)}
          >
            <CirclePlus size={18} />
            Nuevo movimiento
          </button>
        )}
      </div>

      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar producto..."
      />

      {loading ? (
        <p className="inventory-list-empty">Cargando...</p>
      ) : filteredProducts.length === 0 ? (
        <p className="inventory-list-empty">No hay productos registrados.</p>
      ) : (
        <div className="inventory-list-table-wrapper">
          <table className="inventory-list-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Unidad</th>
                <th>Stock disponible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const stock = stockByProduct[product.id]
                const isLow = stock === 0
                return (
                  <tr
                    key={product.id}
                    className="inventory-list-row"
                    onClick={() => navigate(`/inventory/${product.id}`)}
                  >
                    <td>{product.name}</td>
                    <td>{product.unit}</td>
                    <td>
                      <span className={`inventory-list-stock ${isLow ? 'is-empty' : ''}`}>
                        {stock !== null && stock !== undefined ? `${stock} ${product.unit}` : '—'}
                      </span>
                    </td>
                    <td className="inventory-list-icon-cell">
                      <Eye size={16} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Registrar movimiento" onClose={handleClose}>
        {error && <div className="inventory-form-error">{error}</div>}
        
        <div className="modal-field">
          <label className="modal-field-label">Producto</label>
          <select
            className="reason-picker-select"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">Selecciona un producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

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