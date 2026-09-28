import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import api from '../../services/api'
import SearchInput from '../../components/SearchInput/SearchInput'
import './Inventory.css'

export default function Inventory() {
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function loadData() {
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

    loadData()
  }, [])

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="inventory-list-main">
      <h1 className="inventory-list-title">Inventario</h1>

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
                const isLow = stock !== null && stock !== undefined && stock === 0
                return (
                  <tr
                    key={product.id}
                    className="inventory-list-row"
                    onClick={() => navigate(`/products/${product.id}/inventory`)}
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
    </main>
  )
}