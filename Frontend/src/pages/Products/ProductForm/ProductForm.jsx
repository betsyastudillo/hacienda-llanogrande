import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../../services/api'
import './ProductForm.css'

const VALID_UNITS = [
  { value: 'kg', label: 'Kilogramo' },
  { value: 'tonelada', label: 'Tonelada' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'canasta', label: 'Canasta' },
  { value: 'bulto', label: 'Bulto' },
]

export default function ProductForm() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(productId)

  const [baseProducts, setBaseProducts] = useState([])
  const [isPack, setIsPack] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: '',
    price: '',
    tax_rate: '0',
    unit: 'unidad',
    approx_weight_kg: '',
    parent_product_id: '',
    units_per_pack: '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/products/').then((res) => {
      setBaseProducts(res.data.filter((m) => !m.parent_product_id))
    })
  }, [])

  useEffect(() => {
    if (!isEditing) return
    api.get(`/products/${productId}`).then((res) => {
      const m = res.data

      setForm({
        name: m.name,
        category: m.category || '',
        price: String(Number(m.price)),
        tax_rate: String(Number(m.tax_rate)),
        unit: m.unit,
        approx_weight_kg: m.approx_weight_kg != null ? String(m.approx_weight_kg) : '',
        parent_product_id: m.parent_product_id || '',
        units_per_pack: m.units_per_pack != null ? String(Number(m.units_per_pack)) : '',
      })
      setIsPack(Boolean(m.parent_product_id))
      setLoading(false)
    })
  }, [productId, isEditing])

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleSubmit = async () => {
    setError('')

    if (!form.name || !form.price) {
      setError('Nombre y precio son obligatorios')
      return
    }

    if (isPack && (!form.parent_product_id || !form.units_per_pack)) {
      setError('Selecciona el producto base y la cantidad por paquete')
      return
    }

    setSubmitting(true)

    const payload = {
      name: form.name,
      category: form.category || null,
      price: form.price,
      tax_rate: form.tax_rate,
      unit: form.unit,
      approx_weight_kg: form.approx_weight_kg ? form.approx_weight_kg : null,
      parent_product_id: isPack ? form.parent_product_id : null,
      units_per_pack: isPack ? form.units_per_pack : null,
    }

    try {
      if (isEditing) {
        const response = await api.put(`/products/${productId}`, payload)

      } else {
        await api.post('/products/', payload)
      }
      navigate('/products')
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar el producto')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="product-form-main"><p>Cargando...</p></main>

  return (
    <main className="product-form-main">
      <h1 className="product-form-title">{isEditing ? 'Editar producto' : 'Nuevo producto'}</h1>

      {error && <div className="product-form-error">{error}</div>}

      <div className="product-form-card">
        {/* {isEditing && (
          <p className='product-form-type-label'>
            {isPack ? 'Editando un paquete / presentación' : 'Editando un producto base'}
          </p>
        )} */}
        {!isEditing && (
        <div className="product-form-toggle-row">
          <button
            type="button"
            className={`product-form-toggle-btn ${!isPack ? 'is-active' : ''}`}
            onClick={() => setIsPack(false)}
          >
            Producto base
          </button>
          <button
            type="button"
            className={`product-form-toggle-btn ${isPack ? 'is-active' : ''}`}
            onClick={() => setIsPack(true)}
          >
            Paquete / presentación
          </button>
        </div>
        )}

        <div className="product-form-field">
          <label className="product-form-label">Nombre</label>
          <input
            className="product-form-input"
            value={form.name}
            onChange={handleChange('name')}
            placeholder={isPack ? 'ej. Manzana Roja x24' : 'ej. Manzana Roja'}
          />
        </div>

        <div className="product-form-field">
          <label className="product-form-label">Categoría</label>
          <input
            className="product-form-input"
            value={form.category}
            onChange={handleChange('category')}
            placeholder="ej. Frutas"
          />
        </div>

        {isPack && (
          <>
            <div className="product-form-field">
              <label className="product-form-label">Producto base</label>
              <select
                className="product-form-input"
                value={form.parent_product_id}
                onChange={handleChange('parent_product_id')}
              >
                <option value="">Selecciona el producto base</option>
                {baseProducts.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="product-form-field">
              <label className="product-form-label">Cantidad por paquete</label>
              <input
                type="number"
                step="1"
                min="1"
                className="product-form-input"
                value={form.units_per_pack}
                onChange={handleChange('units_per_pack')}
                placeholder="ej. 24"
              />
            </div>
          </>
        )}

        {!isPack && (
          <div className="product-form-field">
            <label className="product-form-label">Unidad de medida</label>
            <select className="product-form-input" value={form.unit} onChange={handleChange('unit')}>
              {VALID_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="product-form-row">
          <div className="product-form-field">
            <label className="product-form-label">Precio {isPack ? 'del paquete' : `por ${form.unit}`}</label>
            <input
              type="number"
              step="0.01"
              className="product-form-input"
              value={form.price}
              onChange={handleChange('price')}
            />
          </div>

          <div className="product-form-field">
            <label className="product-form-label">IVA</label>
            <input
              type="number"
              step="0.01"
              className="product-form-input"
              value={form.tax_rate}
              onChange={handleChange('tax_rate')}
            />
          </div>
        </div>

        <div className="product-form-field">
          <label className="product-form-label">
            Peso aproximado (kg) {isPack ? <span className='text-secondary-form'>— déjalo vacío para calcularlo automático</span> : ''}
            
          </label>
          <input
            type="number"
            step="0.01"
            className="product-form-input"
            value={form.approx_weight_kg}
            onChange={handleChange('approx_weight_kg')}
            placeholder={isPack ? 'Automático si se deja vacío' : 'Opcional'}
          />
        </div>
      </div>

      <div className="product-form-actions">
        <button type="button" className="product-form-cancel-btn" onClick={() => navigate('/products')}>
          Cancelar
        </button>
        <button type="button" className="product-form-submit-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </main>
  )
}