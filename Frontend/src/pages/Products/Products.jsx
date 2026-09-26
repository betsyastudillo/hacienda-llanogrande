import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, CirclePlus, Boxes, Eye, Pencil } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import SearchInput from '../../components/SearchInput/SearchInput'
import './Products.css'

export default function Products() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const canManage = hasPermission('product:gestionar')
  const canViewInventory = hasPermission('inventory:ver')
  const canSeeStock = canViewInventory || hasPermission('order:crear')

  useEffect(() => {
    async function loadProducts() {
      const res = await api.get('/products/')
      setProducts(res.data)
      setLoading(false)

      if (!canSeeStock) return

      // Solo se consulta stock de los productos PADRE (sin parent_product_id) por ahora
      const baseProducts = res.data.filter((p) => !p.parent_product_id)
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
    }

    loadProducts()
  }, [canSeeStock])

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

  const filteredProducts = products.filter((m) => {
    const term = searchTerm.toLowerCase()
    return m.name.toLowerCase().includes(term) || m.category?.toLowerCase().includes(term)
  })

  // Los paquetes se muestran agrupados justo debajo de su producto base
  const baseProducts = filteredProducts.filter((m) => !m.parent_product_id)
  const packsByParent = filteredProducts.reduce((acc, m) => {
    if (m.parent_product_id) {
      acc[m.parent_product_id] = [...(acc[m.parent_product_id] || []), m]
    }
    return acc
  }, {})

  return (
    <main className="products-main">
      <div className="products-header">
        <h1 className="products-title">Productos</h1>
        {canManage && (
          <button className="products-create-btn" onClick={() => navigate('/products/new')}>
            <CirclePlus size={18} />
            Nuevo
          </button>
        )}
      </div>

      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar por nombre o categoría..."
      />

      {loading ? (
        <p className="products-empty">Cargando productos...</p>
      ) : baseProducts.length === 0 ? (
        <p className="products-empty">No hay productos registrados.</p>
      ) : (
        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Presentación</th>
                {canSeeStock && <th>Disponibilidad</th>}
                {canManage && <th>Acciones</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {baseProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  packs={packsByParent[product.id] || []}
                  stock={stockByProduct[product.id]}
                  canManage={canManage}
                  canViewInventory={canViewInventory}
                  canSeeStock={canSeeStock}
                  navigate={navigate}
                  formatCurrency={formatCurrency}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function ProductRow({ product, packs, stock, canManage, canViewInventory, canSeeStock, navigate, formatCurrency }) {

  const isOutOfStock = stock === 0


  return (
    <>
      <tr className="products-row-base">
        <td>
          <div className="products-name-cell">
            {product.name}
          </div>
        </td>
        <td>{product.category || '—'}</td>
        <td>{formatCurrency(product.price)}</td>
        <td>{product.unit}</td>

        {canSeeStock && (
          <td>
            {canViewInventory ? (
              <div className='products-stock-cell'>
                <span className='products-stock-value'>
                  {stock !== null && stock !== undefined ? `${stock} ${product.unit}` : '—'}
                </span>
                <button
                  type='button'
                  className='products-stock-link'
                  onClick={() => navigate(`/products/${product.id}/inventory`)}
                  >
                  <Eye size={16} />
                </button>
              </div>
            ) : (
              isOutOfStock ? <span className='products-out-of-stock-badge'>Agotado</span> : <span className='products-with-stock-badge'> Disponible </span>
            )}
          </td>
        )}
        {canManage && (
          <td>
            <button
              type='button'
              className='products-edit-btn'
              onClick={() => navigate(`/products/${product.id}/edit`)}
            >
              <Pencil size={16}/>
            </button>
          </td>
        )}
      </tr>

      {packs.map((pack) => (
        <tr key={pack.id} className="products-row-pack">
          <td>
            <div className="products-name-cell products-pack-indent">
              ↳ {pack.name}
            </div>
          </td>
          <td>{pack.category || '—'}</td>
          <td>{formatCurrency(pack.price)}</td>
          <td>Pqt x {Number(pack.units_per_pack)}</td>
          {canSeeStock && ( 
            <td className={canViewInventory ? "products-empty-inline" : ''}>
              {canViewInventory ? `Usa stock de ${product.name}` : ''}
            </td>
          )}
          {canManage && (
            <td>
              <button
                type="button"
                className="products-edit-btn"
                onClick={() => navigate(`/products/${pack.id}/edit`)}
              >
                <Pencil size={16}/>
              </button>
            </td>
          )}
        </tr>
      ))}
    </>
  )
}