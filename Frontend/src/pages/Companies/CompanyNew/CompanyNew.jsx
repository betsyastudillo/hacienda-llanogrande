import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../../services/api'
import { JURIDICA_DOCUMENT_TYPES, NATURAL_DOCUMENT_TYPES } from '../../../constants/companyDocuments'
import './CompanyNew.css'

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

  const handleAddToQueue = () => {
  setError('')

  if (!documentType || !file) {
    setError('Selecciona el tipo de documento y el archivo')
    return
  }

  setPendingDocs([...pendingDocs, { documentType, file, id: crypto.randomUUID() }])
  setDocumentType('')
  setFile(null)
}

const handleRemoveFromQueue = (id) => {
  setPendingDocs(pendingDocs.filter((d) => d.id !== id))
}

const handleUploadAll = async () => {
  setError('')

  if (pendingDocs.length === 0) {
    setError('Agrega al menos un documento antes de subir')
    return
  }

  setUploading(true)
  const succeeded = []
  const failed = []

  for (const doc of pendingDocs) {
    try {
      const formData = new FormData()
      formData.append('document_type', doc.documentType)
      formData.append('file', doc.file)

      const response = await api.post(`/documents/${companyId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      succeeded.push(response.data)
    } catch (err) {
      failed.push(doc.documentType)
    }
  }

  setUploadedDocs([...uploadedDocs, ...succeeded])
  setPendingDocs(pendingDocs.filter((d) => failed.includes(d.documentType))) // deja en cola solo los que fallaron

  if (failed.length > 0) {
    setError(`No se pudieron subir: ${failed.map(documentTypeLabel).join(', ')}. Puedes reintentar.`)
  }

  setUploading(false)
}

  const documentTypeLabel = (value) =>
    documentTypes.find((t) => t.value === value)?.label || value

  return (
    <main className="company-form-main">
      <h1 className="company-form-title">Nueva empresa</h1>

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
              placeholder={form.person_type === 'natural' ? 'ej. Juan Pérez Gómez' : 'ej. Constructora Galindo S.A.S.'}
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
            Empresa creada. Agrega los documentos que necesites y súbelos todos juntos (opcional, puedes completarlo después).
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
                {documentTypes.map((t) => (
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

          <button type="button" className="company-form-add-queue-btn" onClick={handleAddToQueue}>
            + Agregar
          </button>

          {pendingDocs.length > 0 && (
            <div className="company-form-queue-list">
              <p className="company-form-uploaded-title">Por subir</p>
              {pendingDocs.map((doc) => (
                <div key={doc.id} className="company-form-queue-row">
                  <span>{documentTypeLabel(doc.documentType)} — {doc.file.name}</span>
                  <button
                    type="button"
                    className="company-form-queue-remove-btn"
                    onClick={() => handleRemoveFromQueue(doc.id)}
                  >
                    Quitar
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="company-form-upload-btn"
                onClick={handleUploadAll}
                disabled={uploading}
              >
                {uploading ? 'Subiendo...' : `Subir ${pendingDocs.length} documento(s)`}
              </button>
            </div>
          )}

          {uploadedDocs.length > 0 && (
            <div className="company-form-uploaded-list">
              <p className="company-form-uploaded-title">Documentos subidos</p>
              {uploadedDocs.map((doc) => (
                <div key={doc.id} className="company-form-uploaded-row">
                  <span>{documentTypeLabel(doc.document_type)}</span>
                  <span className="company-form-uploaded-status">Pendiente de revisión</span>
                </div>
              ))}
            </div>
          )}

          <div className="company-form-actions">
            <button type="button" className="company-form-submit-btn" onClick={() => navigate('/companies')}>
              Finalizar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}