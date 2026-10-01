import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { JURIDICA_DOCUMENT_TYPES, NATURAL_DOCUMENT_TYPES, REQUIRED_JURIDICA_DOCS, REQUIRED_NATURAL_DOCS } from '../../../constants/companyDocuments'
import './CompanyNew.css'
import { Trash } from 'lucide-react'

// Listas vinculantes para revisar de las empresas, se hace un "check list" para que quien cree, verifique que buscó información en estas listas.
export const COMPLIANCE_CHECKS_COMMON = [
  { key: 'listas_vinculantes', label: 'Listas vinculantes (ONU, OFAC/Lista Clinton)' },
  { key: 'antecedentes_judiciales', label: 'Antecedentes judiciales (Policía Nacional)' },
]

export const COMPLIANCE_CHECKS_CONSTRUCTION = [
  { key: 'dian_proveedores_ficticios', label: 'Boletín de Proveedores Ficticios (DIAN)' },
]

export const COMPLIANCE_CHECKS_AGRO = [
  { key: 'contrabando', label: 'Listados de control de contrabando' },
]

export default function CompanyNew() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [companyId, setCompanyId] = useState(null)

  const [sameAsOperational, setSameAsOperational] = useState(true)

  const [form, setForm] = useState({
    legal_name: '',
    display_name: '',
    nit: '',
    type: 'client', // fijo — este formulario siempre crea empresas cliente
    person_type: 'juridica',
    address: '',
    phone: '',
    email: '',
    fiscal_address: '',
    fiscal_phone: '',
    fiscal_email: '',
  })

  const [documentType, setDocumentType] = useState('')
  const [file, setFile] = useState(null)
  const [pendingDocs, setPendingDocs] = useState([])
  const [customDocumentLabel, setCustomDocumentLabel] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const documentTypes = form.person_type === 'natural' ? NATURAL_DOCUMENT_TYPES : JURIDICA_DOCUMENT_TYPES

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleCreateCompany = async () => {
    setError('')

    if (!form.legal_name || !form.nit || !form.address || !form.phone || !form.email) {
      setError('Nombre, NIT, dirección, teléfono y correo son obligatorios')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        fiscal_address: sameAsOperational ? null : form.fiscal_address || null,
        fiscal_phone: sameAsOperational ? null : form.fiscal_phone || null,
        fiscal_email: sameAsOperational ? null : form.fiscal_email || null,
      }

      const response = await api.post('/companies/', payload)
      setCompanyId(response.data.id)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo crear la empresa')
    } finally {
      setSubmitting(false)
    }
  }

  const requiredTypes = form.person_type === 'natural' ? REQUIRED_NATURAL_DOCS : REQUIRED_JURIDICA_DOCS
  const queuedTypes = new Set(pendingDocs.map((d) => d.documentType))
  const missingRequiredDocs = requiredTypes.filter((t) => !queuedTypes.has(t))

  // Para que cuando seleccione un documento, deje de aparecer en el select
  const usedTypes = new Set(pendingDocs.map((d) => d.documentType))
  
  // La opción de "otro" documento siempre queda disponible, porque puede haber más de un documento "personalizado"
  const availableDocumentTypes = documentTypes.filter(
    (t) => t.value === 'otro' || !usedTypes.has(t.value)
  )

  const handleAddToQueue = () => {
    setError('')

    if (!documentType || !file) {
      setError('Selecciona el tipo de documento y el archivo')
      return
    }

    const actualType = documentType === 'otro' ? customDocumentLabel.trim() : documentType

    if (documentType === 'otro' && !actualType) {
      setError('Especifica el nombre del documento')
      return
    }

    setPendingDocs([...pendingDocs, { documentType: actualType, file, id: crypto.randomUUID() }])
    setDocumentType('')
    setFile(null)
    setCustomDocumentLabel('')
  }

  const handleRemoveFromQueue = (id) => {
    setPendingDocs(pendingDocs.filter((d) => d.id !== id))
  }

  const handleFinalize = async () => {
    setError('')
    setUploading(true)

    const succeeded = []
    const failed = []

    for (const doc of pendingDocs) {
      try {
        const formData = new FormData()
        formData.append('document_type', doc.documentType)
        formData.append('file', doc.file)

        const response = await api.post(`/documents/${companyId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        succeeded.push(response.data)
      } catch (err) {
        console.log('Fallo al subir', doc.documentType, err.response?.status, err.response?.data)
        failed.push(doc)
      }
    }

    setUploadedDocs([...uploadedDocs, ...succeeded])
    setPendingDocs(failed)
    setUploading(false)

    if (failed.length > 0) {
      setError(`No se pudieron subir: ${failed.map((d) => documentTypeLabel(d.documentType)).join(', ')}. Revisa la lista e intenta de nuevo.`)
      return
    }

    navigate('/companies')
  }

  const documentTypeLabel = (value) =>
    documentTypes.find((t) => t.value === value)?.label || value

  return (
    <main className="company-form-main">
      <h1 className="company-form-title">Crear empresa</h1>

      <div className="company-form-steps">
        <span className={`company-form-step ${step === 1 ? 'is-active' : 'is-done'}`}>1. Datos</span>
        <span className={`company-form-step ${step === 2 ? 'is-active' : ''}`}>2. Documentos</span>
      </div>

      {error && <div className="company-form-error">{error}</div>}

      {step === 1 && (
        <div className="company-form-card">
          <div className="company-form-field">
            <label className="company-form-label">Tipo de persona</label>
            <select
              className="company-form-input"
              value={form.person_type}
              onChange={handleChange('person_type')}
            >
              <option value="juridica">Jurídica</option>
              <option value="natural">Natural</option>
            </select>
          </div>

          <div className="company-form-field">
            <label className="company-form-label">
              {form.person_type === 'natural' ? 'Nombre completo' : 'Razón social'}
            </label>
            <input
              className="company-form-input"
              value={form.legal_name}
              onChange={handleChange('legal_name')}
              placeholder={form.person_type === 'natural' ? 'ej. Juan Pérez Gómez' : 'ej. Empresa XYZ S.A.S.'}
            />
          </div>

          <div className="company-form-field">
            <label className="company-form-label">Nombre corto (opcional)</label>
            <input
              className="company-form-input"
              value={form.display_name}
              onChange={handleChange('display_name')}
            />
          </div>

          <div className="company-form-row">
            <div className="company-form-field">
              <label className="company-form-label">{form.person_type === 'natural' ? 'Cédula' : 'NIT'}</label>
              <input
                className="company-form-input"
                value={form.nit}
                onChange={handleChange('nit')}
              />
            </div>
          </div>

          <p className="company-form-section-title">Datos de contacto</p>

          <div className="company-form-field">
            <label className="company-form-label">Dirección</label>
            <input
              className="company-form-input"
              value={form.address}
              onChange={handleChange('address')}
            />
          </div>

          <div className="company-form-row">
            <div className="company-form-field">
              <label className="company-form-label">Teléfono</label>
              <input
                className="company-form-input"
                value={form.phone}
                onChange={handleChange('phone')}
              />
            </div>

            <div className="company-form-field">
              <label className="company-form-label">Correo</label>
              <input
                type="email"
                className="company-form-input"
                value={form.email}
                onChange={handleChange('email')}
              />
            </div>
          </div>

          <label className="company-form-checkbox-row">
            <input
              type="checkbox"
              checked={sameAsOperational}
              onChange={(e) => setSameAsOperational(e.target.checked)}
            />
            Los datos fiscales (RUT) coinciden con los de contacto
          </label>

          {!sameAsOperational && (
            <>
              <p className="company-form-section-title">Datos fiscales (según RUT)</p>

              <div className="company-form-field">
                <label className="company-form-label">Dirección fiscal</label>
                <input
                  className="company-form-input"
                  value={form.fiscal_address}
                  onChange={handleChange('fiscal_address')}
                />
              </div>

              <div className="company-form-row">
                <div className="company-form-field">
                  <label className="company-form-label">Teléfono fiscal</label>
                  <input
                    className="company-form-input"
                    value={form.fiscal_phone}
                    onChange={handleChange('fiscal_phone')}
                  />
                </div>

                <div className="company-form-field">
                  <label className="company-form-label">Correo fiscal</label>
                  <input
                    type="email"
                    className="company-form-input"
                    value={form.fiscal_email}
                    onChange={handleChange('fiscal_email')}
                  />
                </div>
              </div>
            </>
          )}

          <div className="company-form-actions">
            <button type="button" className="company-form-cancel-btn" onClick={() => navigate('/companies')}>
              Cancelar
            </button>
            <button
              type="button"
              className="company-form-submit-btn"
              onClick={handleCreateCompany}
              disabled={submitting}
            >
              {submitting ? 'Creando...' : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="company-form-card">
          <p className="company-form-hint">
            Para completar el proceso de creación, agrega todos los documentos requeridos y finaliza para subirlos juntos.
          </p>

          <div className="company-form-row">
            <div className="company-form-field">
              <label className="company-form-label">Tipo de documento</label>
              <select
                className="company-form-input"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="">Selecciona un tipo</option>
                {availableDocumentTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="company-form-field">
              <label className="company-form-label">Archivo</label>
              <input
                type="file"
                className="company-form-input"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
          </div>

          {documentType === 'otro' && (
            <input
              type="text"
              className="company-form-input"
              placeholder="Especifica qué documento es"
              value={customDocumentLabel}
              onChange={(e) => setCustomDocumentLabel(e.target.value)}
            />
          )}

          <button type="button" className="company-form-add-queue-btn" onClick={handleAddToQueue}>
            + Agregar
          </button>

          {pendingDocs.length > 0 && (
            <div className="company-form-queue-list">
              <p className="company-form-uploaded-title">Documentos listos para subir</p>
              {pendingDocs.map((doc) => (
                <div key={doc.id} className="company-form-queue-row">
                  <span>{documentTypeLabel(doc.documentType)} — {doc.file.name}</span>
                  <button
                    type="button"
                    className="company-form-queue-remove-btn"
                    onClick={() => handleRemoveFromQueue(doc.id)}
                  >
                    <Trash size={16}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {pendingDocs.length > 0 && missingRequiredDocs.length > 0 && (
            <p className="company-form-missing-note">
              Aún falta: {missingRequiredDocs.map(documentTypeLabel).join(', ')}
            </p>
          )}

          <div className="company-form-actions">
            <button
              type="button"
              className="company-form-submit-btn"
              onClick={handleFinalize}
              disabled={uploading || missingRequiredDocs.length > 0}
            >
              {uploading ? 'Subiendo...' : 'Finalizar'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}