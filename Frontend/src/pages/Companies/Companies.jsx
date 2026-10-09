import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import SearchInput from '../../components/SearchInput/SearchInput'
import StatusIconBadge from '../../components/StatusIconBadge/StatusIconBadge'
import StatusHelpPopover from '../../components/StatusHelpPopover/StatusHelpPopover'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS, COMPANY_STATUS_ICONS } from '../../constants/companyStatus'
import { CirclePlus, Eye } from 'lucide-react'
import './Companies.css'


export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingFirst, setPendingFirst] = useState(false)

  const [showInactive, setShowInactive] = useState(false)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('company:gestionar')

  const navigate = useNavigate()


  useEffect(() => {
    async function fetchCompanies() {
      try {
        const response = await api.get('/companies/', {
          params: { company_type: 'client', include_inactive: showInactive },
        })

        setCompanies(response.data)
      } catch (err) {
        setError('No se pudieron cargar las empresas')
      } finally {
        setLoading(false)
      }
    }
    fetchCompanies()
  }, [showInactive])

  const filteredCompanies = companies.filter((c) => {
    const term = searchTerm.toLowerCase()
    const name = c.display_name || c.legal_name
    return name.toLowerCase().includes(term) || c.client_code.toLowerCase().includes(term)
  })

  const visibleCompanies = pendingFirst
    ? [...filteredCompanies].sort((a, b) => Number(b.needs_action) - Number(a.needs_action))
    : filteredCompanies

  const actionCount = companies.filter((c) => c.needs_action).length

  const companyStatusHelpItems = Object.keys(COMPANY_STATUS_LABELS).map((key) => ({
    key,
    icon: COMPANY_STATUS_ICONS[key],
    textColor: COMPANY_STATUS_COLORS[key]?.text,
    label: COMPANY_STATUS_LABELS[key],
  }))

  return (
      <main className="companies-main">
        <div className="companies-main-header">
          <h1 className="companies-title">Empresas / Clientes</h1>
          {canCreate && (
            <button 
              className='companies-create-btn' 
              onClick={() => navigate('/companies/new')}
            >
              <CirclePlus size={18} />
              Crear
            </button>
          )}
          </div>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por nombre..."
          />

          <div className="companies-toolbar">
            <div className="companies-toggles">
              <label className="companies-show-inactive">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Mostrar inactivas
              </label>
              <label className="companies-show-inactive">
                <input type="checkbox" checked={pendingFirst} onChange={(e) => setPendingFirst(e.target.checked)} />
                Pendientes primero
              </label>
            </div>
            {actionCount > 0 && (
              <span className="companies-action-count">
                {actionCount} {actionCount === 1 ? 'requiere' : 'requieren'} tu atención
              </span>
            )}
          </div>

        {loading && <p className="companies-empty">Cargando empresas...</p>}
        {error && <p className="companies-empty companies-error-text">{error}</p>}

        {!loading && !error && filteredCompanies.length === 0 && (
          <p className="companies-empty">Todavía no hay empresas registradas.</p>
        )}

        {!loading && !error && filteredCompanies.length > 0 && (
          <div className="companies-table-wrapper">
            <table className="companies-table">
              <thead>
                <tr>
                  <th>Razón social</th>
                  <th>Código</th>
                  <th>Dirección</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>
                    <StatusHelpPopover
                      triggerLabel="Estado ⓘ"
                      title="Estados de la empresa"
                      items={companyStatusHelpItems}
                    />
                  </th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleCompanies.map((company) => {
                  const colors = COMPANY_STATUS_COLORS[company.verification_status] || { bg: '#ece9e2', text: '#5f5e5a' }
                  const Icon = COMPANY_STATUS_ICONS[company.verification_status]

                  return (
                  <tr
                    key={company.id}
                    className={`companies-row ${!company.is_active ? 'companies-row-inactive' : ''} ${company.needs_action ? 'is-attention' : ''}`}
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <td className="companies-name-cell" title={company.display_name || company.legal_name}>
                      {company.display_name || company.legal_name}
                      {company.needs_action && <span className="companies-attention">Acción</span>}
                    </td>
                    <td>{company.client_code}</td>
                    <td className="companies-address-cell" title={company.address}>
                      {company.address}
                    </td>
                    <td>{company.phone}</td>
                    <td className="companies-email-cell" title={company.email}>
                      {company.email}
                    </td>
                    <td>
                      <StatusIconBadge
                        icon={Icon}
                        bgColor={colors.bg}
                        textColor={colors.text}
                        title={COMPANY_STATUS_LABELS[company.verification_status]}
                      />
                    </td>
                    <td className="companies-id-cell">
                      <button 
                        className='companies-edit-btn' 
                        onClick={(e) => {
                          e.stopPropagation() //Porque la fila completa ya tiene un onClick, entonces que no haga doble carga
                          navigate(`/companies/${company.id}`)
                        }}
                      >
                        <Eye size={18}/>
                      </button>
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