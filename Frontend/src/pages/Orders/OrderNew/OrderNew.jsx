import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import { estimateWeightKg } from '../../../constants/units'
import { Pencil, Trash } from 'lucide-react'
import { formatCurrency } from '../../../utils/formatCurrency'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { formatQuantity } from '../../../utils/formatQuantity'
import './OrderNew.css'

export default function OrderNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fail = (message) => showToast(message, 'error')

  const { orderId } = useParams()
  const isEdit = Boolean(orderId)

  const [products, setProducts] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')

  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [items, setItems] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [editingIndex, setEditingIndex] = useState(null)

  // Para el modo edición
  const [loadingEdit, setLoadingEdit] = useState(isEdit)
  const [reserved, setReserved] = useState({})        // producto -> cantidad que este pedido ya tiene reservada
  const [companyName, setCompanyName] = useState('')
  const [orderCompanyId, setOrderCompanyId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = user?.role === 'admin'

  // Al editar, el stock que ve el usuario ya descontó lo que este pedido reservó: se le suma de vuelta
  const stockOf = (productId) => (stockByProduct[productId] || 0) + (reserved[productId] || 0)

  const buildItem = (product, productId, qty, fallbackPrice) => ({
    product_id: productId,
    product_name: product?.name,
    product_unit: product?.unit,
    approx_weight_kg: product?.approx_weight_kg,
    unit_price: product?.price ?? fallbackPrice,
    quantity_m3: qty,
  })

  // Muestra solo los productos que tienen stock, y se muestra en la creación la ctd disponible al seleccionar uno.
  useEffect(() => {
    async function load() {
      try {
        const productRes = await api.get('/products/')
        const list = productRes.data
        setProducts(list)

        const stockEntries = await Promise.all(
          list.map(async (p) => {
            try {
              const stockRes = await api.get(`/inventory/products/${p.id}/stock`)
              return [p.id, stockRes.data.current_stock]
            } catch {
              return [p.id, 0]
            }
          })
        )
        setStockByProduct(Object.fromEntries(stockEntries))

        if (!isEdit) return

        const order = (await api.get(`/orders/${orderId}`)).data

        if (order.status !== 'created') {
          fail ('Solo se pueden editar pedidos en estado "creado".')
          return navigate(`/orders/${orderId}`)
        }

        // Si tiene la proforma no se edita, el PDF queda con el total que tenía
        let hasPayment = false
        try {
          await api.get(`/payments/order/${orderId}`)
          hasPayment = true
        } catch {
          // 404 no hay proforma
        }

        if (hasPayment) {
          fail ('Este pedido ya tiene proforma y no se puede editar. Anúlalo y crea uno nuevo.')
          return navigate(`/orders/${orderId}`)
        }

        setCompanyName(order.company_display_name)
        setOrderCompanyId(order.company_id)
        setReserved(Object.fromEntries(order.items.map((i) => [i.product_id, i.quantity_m3])))
        setItems(
          order.items.map((i) =>
            buildItem(list.find((p) => p.id === i.product_id), i.product_id, i.quantity_m3, i.unit_price)
          )
        )
      } catch (err) {
        fail(getErrorMessage(err, 'No se pudo cargar la información'))
        if (isEdit) navigate('/orders')
      } finally {
        setLoadingEdit(false)
      }
    }
    load()
  }, [orderId])

  useEffect(() => {
    if (!isAdmin || isEdit) return

    api
    .get('/companies/', { params: {company_type: 'client', verification_status: 'approved' }, })
    .then((res) => setCompanies(res.data))
  }, [isAdmin, isEdit])

  const handleAddItem = () => {
    const qty = Number(quantity)

    if (!selectedProductId || !quantity || qty <= 0) return fail('Selecciona un producto y una cantidad válida')
    if (!Number.isInteger(qty)) return fail('La cantidad debe ser un número entero, sin decimales')

    const product = products.find((m) => m.id === selectedProductId)

    // Validación para que no agreguen más de lo que hay en stock
    const availableStock = stockOf(selectedProductId)

    if (editingIndex !== null) {
      // Editamos una fila existente, como esa es la única de ese producto en la lista, se compara directamente con el stock disponible
      if (qty > availableStock)
        return fail(`Solo hay ${availableStock} ${product?.unit} disponibles de ${product?.name}`)

      const updatedItems = [...items]
      updatedItems[editingIndex] = buildItem(product, selectedProductId, qty)
      setItems(updatedItems)
      setEditingIndex(null)
    } else {
      // Si ya agregaron el producto antes, y vuelven a agregar el mismo, se sume y no coloque 2 filas sobre el mismo producto.
      const existingIndex = items.findIndex((i) => i.product_id === selectedProductId)
      const alreadyInCart = existingIndex >= 0 ? items[existingIndex].quantity_m3 : 0

      if (alreadyInCart + qty > availableStock)
        return fail(`Solo hay ${availableStock - alreadyInCart} ${product?.unit} disponibles de ${product?.name}`)
      
      if (existingIndex >= 0) {
        // Si ya existe, actualizamos la cantidad en lugar de agregar un nuevo item
        const updatedItems = [...items]
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity_m3: updatedItems[existingIndex].quantity_m3 + qty,
        }
        setItems(updatedItems)
      } else {
        // Producto nuevo: agrega una fila
        setItems([...items, buildItem(product, selectedProductId, qty)])
      }
      
      // Reiniciamos los campos de selección
      setSelectedProductId('')
      setQuantity('')
    }
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
    if (items.length === 0) return fail('Agrega al menos un producto al pedido')
    if (isAdmin && !isEdit && !selectedCompanyId) return fail('Selecciona la empresa para la que se crea el pedido')

    setSubmitting(true)

    try {
      const payload = {
        items: items.map(({ product_id, quantity_m3 }) => ({ product_id, quantity_m3 })),
      }

      if (isAdmin) {
        payload.company_id = isEdit ? orderCompanyId : selectedCompanyId
      }

      if (isEdit) {
        const r= await api.put(`/orders/${orderId}`, payload)

        showToast('Pedido actualizado')
        navigate(`/orders/${orderId}`)
      } else {
        const response = await api.post('/orders/', payload)
        showToast('Pedido creado. Elige el medio de pago para continuar.')
        navigate(`/orders/${response.data.id}`)
      }

    } catch (err) {
      fail(getErrorMessage(err, isEdit ?  'No se pudo crear el pedido' : 'No se pudo crear el pedido'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingEdit) return <main className="order-new-main"><p>Cargando pedido...</p></main>

  const selectedProduct = products.find((m) => m.id === selectedProductId)
  const selectedParent = selectedProduct?.parent_product_id
    ? products.find((p) => p.id === selectedProduct.parent_product_id)
    : null

  return (
    <main className="order-new-main">
      <button 
        className="company-detail-back-btn" 
        onClick={() => navigate(isEdit ? `/orders/${orderId}` : '/orders')}
      >
        ← {isEdit ? 'Volver al pedido' : 'Volver a pedidos'}
      </button>
      
      <h1 className="order-new-title">{isEdit ? 'Editar pedido' : 'Crear pedido'}</h1>

      {isAdmin && !isEdit && (
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

      {isEdit && <p className="order-new-stock-hint">Empresa: {companyName}</p>}

      <div className="order-new-card">
        <p className="order-new-card-title">Seleccionar productos:</p>
        
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
                  {m.name} · {formatCurrency(m.price)} / {m.parent_product_id ? 'paquete' : m.unit}
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
            <p className="order-new-stock-hint">
              Disponible: {formatQuantity(stockByProduct[selectedProductId], selectedProduct, selectedParent)}
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
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const product = products.find((p) => p.id === item.product_id)
                  const parent = product?.parent_product_id
                    ? products.find((p) => p.id === product.parent_product_id)
                    : null
                  const estimatedKg = estimateWeightKg(item.approx_weight_kg, item.product_unit, item.quantity_m3)
                  const lineTotal = item.unit_price * item.quantity_m3
                  return(
                    <tr key={item.product_id}>
                    <td>{item.product_name}</td>
                      <td>{formatQuantity(item.quantity_m3, product, parent)}</td>
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
        <button 
          type="button" 
          className="order-new-cancel-btn" 
          onClick={() => navigate(isEdit ? `/orders/${orderId}` : '/orders')}>
          Cancelar
        </button>

        <button
          type="button"
          className="order-new-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Guardando...' : isEdit ? 'Guardar' : 'Confirmar'}
        </button>
      </div>
    </main>
  )
}