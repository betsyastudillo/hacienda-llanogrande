import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { STATUS_LABELS } from '../../constants/orderStatus'
import SearchInput from '../../components/SearchInput/SearchInput'
import { formatDate } from '../../utils/formatDate'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import StatusHelpPopover from '../../components/StatusHelpPopover/StatusHelpPopover'
import { CirclePlus, Eye } from 'lucide-react'
import './Companies.css'


export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('company:crear')

  const { user, logout } = useAuth()

  const navigate = useNavigate()


  useEffect(() => {
    async function fetchCompanies() {
      try {
        const response = await api.get('/companies/')
        console.log("respuests serv", response.data)
        setCompanies(response.data)
      } catch (err) {
        setError('No se pudieron cargar las empresas')
      } finally {
        setLoading(false)
      }
    }
    fetchCompanies()
  }, [])

  
  // const formatCurrency = (value) =>
  //   new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

  // const companies = companies.filter((company) => {
  //   const term = searchTerm.toLowerCase()

  //   return (
  //     company.id.toLowerCase().includes(term) ||
  //     company.company_display_name?.toLowerCase().includes(term) ||
  //     STATUS_LABELS[company.status]?.toLowerCase().includes(term)
  //   )
  // })

  return (
      <main className="companies-main">
        <div className="companies-main-header">
          <h1 className="companies-title">Empresas</h1>
          {canCreate && (
            <button 
              className='companies-create-btn' 
              // onClick={() => navigate('/companies/new')}
            >
              <CirclePlus size={18} />
              Crear
            </button>
          )}
          </div>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nombre de empresa..."
            />
          {/* </div> */}

        {loading && <p className="companies-empty">Cargando empresas...</p>}
        {error && <p className="companies-empty companies-error-text">{error}</p>}

        {!loading && !error && companies.length === 0 && (
          <p className="companies-empty">Todavía no hay empresas registradas.</p>
        )}
          
        {!loading && !error && companies.length > 0 && (
          <div className="companies-table-wrapper">
            <table className="companies-table">
              <thead>
                <tr>
                  <th>Razón social</th>
                  <th>Código</th>
                  {/* <th>NIT</th> */}
                  <th>Dirección</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="companies-row"
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <td>{company.display_name}</td>
                    <td>{company.client_code}</td>
                    {/* <td>{company.nit}</td> */}
                    <td>{company.address}</td>
                    <td>{company.phone}</td>
                    <td>{company.email}</td>
                    <td>{company.verification_status}</td>
                    <td className="companies-id-cell">
                      <Eye/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
  )
}