import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { STATUS_LABELS } from '../../constants/orderStatus'
import SearchInput from '../../components/SearchInput/SearchInput'
import { formatDate } from '../../utils/formatDate'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS } from '../../constants/companyStatus'
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
        const response = await api.get('/companies/?company_type=client')
        setCompanies(response.data)
      } catch (err) {
        setError('No se pudieron cargar las empresas')
      } finally {
        setLoading(false)
      }
    }
    fetchCompanies()
  }, [])


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
                {companies.map((company) => {
                  const colors = COMPANY_STATUS_COLORS[company.verification_status] || { bg: '#ece9e2', text: '#5f5e5a' }

                  return (
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
                    <td>
                      <StatusBadge
                        label={COMPANY_STATUS_LABELS[company.verification_status]}
                        bgColor={colors.bg}
                        textColor={colors.text}
                      />
                    </td>
                    <td className="companies-id-cell">
                      <Eye/>
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