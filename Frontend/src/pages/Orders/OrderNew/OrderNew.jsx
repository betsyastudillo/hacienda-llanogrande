import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import UnitReferenceHelper from '../../../components/UnitReferenceHelper/UnitReferenceHelper'
import { estimateWeightKg } from '../../../constants/units'
import './OrderNew.css'

export default function OrderNew() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [materials, setMaterials] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')

  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [items, setItems] = useState([])

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    api.get('/materials/').then((res) => setMaterials(res.data))
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    api.get('/companies/').then((res) => {
      setCompanies(res.data.filter((c) => c.type === 'client'))
    })
  }, [isAdmin])

  const handleAddItem = () => {
    setError('')
    if (!selectedMaterialId || !quantity || Number(quantity) <= 0) {
      setError('Selecciona un producto y una cantidad válida')
      return
    }

    const material = materials.find((m) => m.id === selectedMaterialId)

    setItems([
      ...items,
      {
        material_id: selectedMaterialId,
        material_name: material?.name,
        material_unit: material?.unit,
        approx_weight_kg: material?.approx_weight_kg,
        unit_price: material?.price,
        quantity_m3: Number(quantity),
      },
    ])
    setSelectedMaterialId('')
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
        items: items.map(({ material_id, quantity_m3 }) => ({ material_id, quantity_m3 })),
      }
      if (isAdmin) {
        payload.company_id = selectedCompanyId
      }

      const response = await api.post('/orders/', payload)
      navigate(`/orders/${response.data.id}`)
    } catch (err) {
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
        <p className="order-new-card-title">Agregar producto</p>
        
        <UnitReferenceHelper />

        <div className="order-new-item-row">
          <select
            className="order-new-select"
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
          >
            <option value="">Selecciona un producto</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder={
                selectedMaterialId
                ? `Cantidad en ${materials.find((m) => m.id === selectedMaterialId)?.unit || ''}`
                : 'Cantidad'
            }
            className="order-new-input-qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <button type="button" className="order-new-add-btn" onClick={handleAddItem}>
            Agregar
          </button>
        </div>

        {items.length > 0 && (
          <div className='order-new-items-table-wrapper'>
            <table className="order-new-items-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Peso aprox.</th>
                  <th>Precio unitario</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const estimatedKg = estimateWeightKg(item.approx_weight_kg, item.material_unit, item.quantity_m3)
                  const lineTotal = item.unit_price * item.quantity_m3
                  return(
                    <tr key={index}>
                    <td>{item.material_name}</td>
                    <td>{item.quantity_m3} {item.material_unit}</td>
                    <td className="order-new-weight-cell">
                      {estimatedKg !== null ? `≈ ${estimatedKg.toFixed(2)} kg` : '—'}
                    </td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td className="order-new-line-total">{formatCurrency(lineTotal)}</td>
                    <td>
                      <button
                        type="button"
                        className="order-new-remove-btn"
                        onClick={() => handleRemoveItem(index)}
                        >
                        Quitar
                      </button>
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
                Peso total aproximado: ≈{' '}
                {items
                  .reduce((sum, item) => {
                    const kg = estimateWeightKg(item.approx_weight_kg, item.material_unit, item.quantity_m3)
                    return sum + (kg || 0)
                  }, 0)
                  .toFixed(2)}{' '}
                kg
              </p>
              <p className="order-new-total-price">
                Total del pedido: {formatCurrency(items.reduce((sum, item) => sum + item.unit_price * item.quantity_m3, 0))}
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
          {submitting ? 'Creando...' : 'Crear pedido'}
        </button>
      </div>
    </main>
  )
}