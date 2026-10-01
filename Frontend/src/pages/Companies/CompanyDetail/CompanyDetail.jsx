import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, CircleCheck, CircleX, Clock, Check, X } from 'lucide-react'
import api, { API_BASE_URL } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS } from '../../../constants/companyStatus'
import { JURIDICA_DOCUMENT_TYPES, NATURAL_DOCUMENT_TYPES } from '../../../constants/companyDocuments'
import StatusBadge from '../../../components/StatusBadge/StatusBadge'
import { formatDate } from '../../../utils/formatDate'
import './CompanyDetail.css'

const DOC_STATUS_CONFIG = {
  approved: { label: 'Aprobado', icon: CircleCheck, className: 'is-accent' },
  rejected: { label: 'Rechazado', icon: CircleX, className: 'is-error' },
  pending: { label: 'Pendiente', icon: Clock, className: '' },
}

const ALL_DOCUMENT_TYPES = [...JURIDICA_DOCUMENT_TYPES, ...NATURAL_DOCUMENT_TYPES]

const documentTypeLabel = (value) =>
  ALL_DOCUMENT_TYPES.find((t) => t.value === value)?.label || value

export default function CompanyDetail() {
  const { companyId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [company, setCompany] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canReviewDocs = hasPermission('document:revisar')
  const canApproveCompany = hasPermission('company:aprobar')

  const loadData = async () => {
    const [companyRes, docsRes] = await Promise.all([
      api.get(`/companies/${companyId}`),
      api.get(`/documents/?company_id=${companyId}`),
    ])
    console.log('companyRes', companyRes.data)
    setCompany(companyRes.data)
    setDocuments(docsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [companyId])

  const handleDocumentStatus = async (documentId, status) => {
    setError('')
    try {
      await api.patch(`/documents/${documentId}/status`, { status })
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo actualizar el documento')
    }
  }

  const handleApproveCompany = async () => {
    setError('')
    setSubmitting(true)
    try {
      await api.patch(`/companies/${companyId}/verify`, { decision: 'approved' })
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo aprobar la empresa')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectCompany = async () => {
    setError('')

    if (!rejectionReason.trim()) {
      setError('Escribe el motivo del rechazo')
      return
    }

    setSubmitting(true)
    try {
      const response = await api.patch(`/companies/${companyId}/verify`, {
        decision: 'rejected',
        rejection_reason: rejectionReason,
      })
      console.log('Rechazo de empresa:', response.data)
      setShowRejectBox(false)
      setRejectionReason('')
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo rechazar la empresa')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="company-detail-main"><p>Cargando...</p></main>
  if (!company) return null

  const statusColors = COMPANY_STATUS_COLORS[company.verification_status] || { bg: '#ece9e2', text: '#5f5e5a' }
  const isPending = company.verification_status === 'pending'

  return (
    <main className="company-detail-main">
      <button className="company-detail-back-btn" onClick={() => navigate('/companies')}>
        ← Volver a empresas
      </button>

      <div className="company-detail-header">
        <div>
          <p className="company-detail-eyebrow">{company.client_code}</p>
          <h1 className="company-detail-title">{company.display_name || company.legal_name}</h1>
          <p className="company-detail-subtitle">
            {company.person_type === 'natural' ? 'Persona natural' : 'Persona jurídica'} · {company.document_number}
          </p>
        </div>
        <StatusBadge
          label={COMPANY_STATUS_LABELS[company.verification_status]}
          bgColor={statusColors.bg}
          textColor={statusColors.text}
        />
      </div>

      {error && <div className="company-detail-error">{error}</div>}

      <div className="company-detail-grid">
        <div className="company-detail-card">
          <p className="company-detail-card-title">Datos de contacto</p>
          <div className="company-detail-info-row"><span>Dirección</span><span>{company.address}</span></div>
          <div className="company-detail-info-row"><span>Teléfono</span><span>{company.phone}</span></div>
          <div className="company-detail-info-row"><span>Correo</span><span>{company.email}</span></div>

          {(company.fiscal_address || company.fiscal_phone || company.fiscal_email) && (
            <>
              <p className="company-detail-card-title company-detail-card-title-spaced">Datos fiscales (RUT)</p>
              {company.fiscal_address && <div className="company-detail-info-row"><span>Dirección</span><span>{company.fiscal_address}</span></div>}
              {company.fiscal_phone && <div className="company-detail-info-row"><span>Teléfono</span><span>{company.fiscal_phone}</span></div>}
              {company.fiscal_email && <div className="company-detail-info-row"><span>Correo</span><span>{company.fiscal_email}</span></div>}
            </>
          )}
        </div>

        <div className="company-detail-card">
          <p className="company-detail-card-title">Documentos</p>

          {documents.length === 0 ? (
            <p className="company-detail-empty">No se han subido documentos.</p>
          ) : (
            <div className="company-detail-docs-list">
              {documents.map((doc) => {
                const config = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.pending
                const Icon = config.icon
                return (
                  <div key={doc.id} className="company-detail-doc-row">
                    <div className="company-detail-doc-info">
                      <span className="company-detail-doc-type">{documentTypeLabel(doc.document_type)}</span>
                      <span className={`company-detail-doc-badge ${config.className}`}>
                        <Icon size={12} />
                        {config.label}
                      </span>
                    </div>

                    <div className="company-detail-doc-actions">
                      <a
                        href={`${API_BASE_URL}${doc.document_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="company-detail-download-btn"
                      >
                        <Download size={16} />
                      </a>

                      {canReviewDocs && doc.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="company-detail-doc-approve-btn"
                            onClick={() => handleDocumentStatus(doc.id, 'approved')}
                          >
                            <Check size={16}/>
                          </button>
                          <button
                            type="button"
                            className="company-detail-doc-reject-btn"
                            onClick={() => handleDocumentStatus(doc.id, 'rejected')}
                          >
                            <X size={16}/>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {canApproveCompany && (
        <div className="company-detail-approve-card">
          <p className="company-detail-card-title">Decisión final</p>

          {company.verification_status === 'pending' && !showRejectBox && (
            <>
              <p className="company-detail-approve-hint">
                Revisa los documentos antes de aprobar o rechazar esta empresa.
              </p>
              <div className="company-detail-approve-actions">
                <button
                  type="button"
                  className="company-detail-reject-trigger-btn"
                  onClick={() => setShowRejectBox(true)}
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  className="company-detail-approve-btn"
                  onClick={handleApproveCompany}
                  disabled={submitting}
                >
                  {submitting ? 'Procesando...' : 'Aprobar'}
                </button>
              </div>
            </>
          )}

          {company.verification_status === 'pending' && showRejectBox && (
            <div className="company-detail-reject-box">
              <textarea
                className="company-detail-reject-textarea"
                placeholder="Motivo del rechazo"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="company-detail-approve-actions">
                <button
                  type="button"
                  className="company-detail-cancel-reject-btn"
                  onClick={() => { setShowRejectBox(false); setRejectionReason('') }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="company-detail-reject-confirm-btn"
                  onClick={handleRejectCompany}
                  disabled={submitting}
                >
                  {submitting ? 'Procesando...' : 'Confirmar rechazo'}
                </button>
              </div>
            </div> 
          )}

          {company.verification_status === 'approved' && (
            <p className="company-detail-approve-hint">
              Empresa aprobada{company.verified_at && ` el ${formatDate(company.verified_at)}`}.
            </p>
          )}

          {company.verification_status === 'rejected' && (
            <>
              <p className="company-detail-approve-hint">
                Empresa rechazada{company.verified_at && ` el ${formatDate(company.verified_at)}`}.
              </p>
              <p className="company-detail-rejection-text">
                <strong>Motivo:</strong> {company.rejection_reason}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  )
}