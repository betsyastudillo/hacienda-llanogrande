import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import UnitReferenceHelper from '../../../components/UnitReferenceHelper/UnitReferenceHelper'
import { estimateWeightKg } from '../../../constants/units'
import { Pencil, Trash } from 'lucide-react'
import './OrderNew.css'

export default function OrderNew() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')

  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [items, setItems] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [editingIndex, setEditingIndex] = useState(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = user?.role === 'admin'

  // Muestra solo los productos que tienen stock, y se muestra en la creación la ctd disponible al seleccionar uno.
  useEffect(() => {
  async function loadProducts() {
    const res = await api.get('/products/')
    setProducts(res.data)

    const stockEntries = await Promise.all(
      res.data.map(async (p) => {
        try {
          const stockRes = await api.get(`/inventory/products/${p.id}/stock`)
          return [p.id, stockRes.data.current_stock]
        } catch {
          return [p.id, 0]
        }
      })
    )
    setStockByProduct(Object.fromEntries(stockEntries))
  }

  loadProducts()
}, [])

  useEffect(() => {
    if (!isAdmin) return
    api.get('/companies/').then((res) => {
      setCompanies(res.data.filter((c) => c.type === 'client'))
    })
  }, [isAdmin])

  const handleAddItem = () => {
    setError('')
    const qty = Number(quantity)

    if (!selectedProductId || !quantity || qty <= 0) {
      setError('Selecciona un producto y una cantidad válida')
      return
    }

    if (!Number.isInteger(qty)) {
      setError('La cantidad debe ser un número entero, sin decimales')
      return
    }

    const product = products.find((m) => m.id === selectedProductId)

    const newItem = {
      product_id: selectedProductId,
      product_name: product?.name,
      product_unit: product?.unit,
      approx_weight_kg: product?.approx_weight_kg,
      unit_price: product?.price,
      quantity_m3: Number(quantity),
    }

    if (editingIndex !== null) {
      // Editamos una fila existente, la reemplazamos en la misma posición en que está
      const updatedItems = [...items]
      updatedItems[editingIndex] = newItem
      setItems(updatedItems)
      setEditingIndex(null)
    } else {
      setItems([...items, newItem])
    }
    
    setSelectedProductId('')
    setQuantity('')
  }

  const handleEditItem = (index) => {
    const item = items[index]
    setSelectedProductId(item.product_id)
    setQuantity(String(item.quantity_m3))
    setEditingIndex(index)
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setSelectedProductId('')
    setQuantity('')
  }

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setError('')

    if (items.length === 0) {
      setError('Agrega al menos un producto al pedido')
      return
    }

    if (isAdmin && !selectedCompanyId) {
      setError('Selecciona la empresa para la que se crea el pedido')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        items: items.map(({ product_id, quantity_m3 }) => ({ product_id, quantity_m3 })),
      }
      console.log(payload)
      if (isAdmin) {
        payload.company_id = selectedCompanyId
      }

      const response = await api.post('/orders/', payload)
      navigate(`/orders/${response.data.id}`)

    } catch (err) {
      console.log("error", err)
      setError(err.response?.data?.detail || 'No se pudo crear el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)


  return (
    <main className="order-new-main">
      <h1 className="order-new-title">Crear pedido</h1>

      {error && <div className="order-new-error">{error}</div>}

      {isAdmin && (
        <div className="order-new-field">
          <label className="order-new-label">Empresa</label>
          <select
            className="order-new-select"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
          <option value="">Selecciona una empresa</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.legal_name} ({c.client_code})
            </option>
          ))}
          </select>
        </div>
      )}

      <div className="order-new-card">
        <p className="order-new-card-title">Seleccionar productos:</p>
        
        <UnitReferenceHelper />

        <div className="order-new-item-row">
          <select
            className="order-new-select"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">Selecciona un producto</option>
            {products
              .filter((m) => (stockByProduct[m.id] || 0) > 0)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>

          <input
            type="number"
            step="1"
            min="1"
            placeholder={
                selectedProductId
                ? `Cantidad en ${products.find((m) => m.id === selectedProductId)?.unit || ''}`
                : 'Cantidad'
            }
            className="order-new-input-qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <button type="button" className="order-new-add-btn" onClick={handleAddItem}>
            {editingIndex !== null ? 'Guardar' : 'Agregar'}
          </button>

          {selectedProductId && (
            <p className='order-new-stock-hint'>
              Disponible: {stockByProduct[selectedProductId]} {products.find((m) => m.id === selectedProductId)?.unit}(es)
            </p>
          )}

          {editingIndex !== null && (
            <button type="button" className="order-new-cancel-edit-btn" onClick={handleCancelEdit}>
              Cancelar
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className='order-new-items-table-wrapper'>
            <table className="order-new-items-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Q</th>
                  <th>Peso aprox.</th>
                  <th>Precio unitario</th>
                  <th>Total</th>
                  <th>Acciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const estimatedKg = estimateWeightKg(item.approx_weight_kg, item.product_unit, item.quantity_m3)
                  const lineTotal = item.unit_price * item.quantity_m3
                  return(
                    <tr key={index}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity_m3} {item.product_unit}</td>
                    <td className="order-new-weight-cell">
                      {estimatedKg !== null ? `≈ ${estimatedKg.toFixed(2)} kg` : '—'}
                    </td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td className="order-new-line-total">{formatCurrency(lineTotal)}</td>
                    <td>
                      <div className='order-new-actions-cell'>
                        <button type="button" className="order-new-edit-btn" onClick={() => handleEditItem(index)}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="order-new-remove-btn" onClick={() => handleRemoveItem(index)}>
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
          {items.length > 0 && (
            <div className="order-new-summary">
              <p className="order-new-total-weight">
                Peso total aprox: ≈{' '}
                {items
                  .reduce((sum, item) => {
                    const kg = estimateWeightKg(item.approx_weight_kg, item.product_unit, item.quantity_m3)
                    return sum + (kg || 0)
                  }, 0)
                  .toFixed(2)}{' '}
                kg
              </p>
              <p className="order-new-total-price">
                Total: {formatCurrency(items.reduce((sum, item) => sum + item.unit_price * item.quantity_m3, 0))}
              </p>
            </div>
          )}
        </div>

      <div className="order-new-actions">
        <button type="button" className="order-new-cancel-btn" onClick={() => navigate('/orders')}>
          Cancelar
        </button>
        <button
          type="button"
          className="order-new-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Creando...' : 'Confirmar'}
        </button>
      </div>
    </main>
  )
}