import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash } from 'lucide-react'
import api from '../../../services/api'
import { JURIDICA_DOCUMENT_TYPES, NATURAL_DOCUMENT_TYPES, REQUIRED_JURIDICA_DOCS, REQUIRED_NATURAL_DOCS } from '../../../constants/companyDocuments'
import { getComplianceChecks } from '../../../constants/complianceChecks'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { isValidEmail, isValidPhone } from '../../../utils/validators'
import './CompanyNew.css'


export default function CompanyNew() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [companyId, setCompanyId] = useState(null)

  const [sameAsOperational, setSameAsOperational] = useState(true)

  const [form, setForm] = useState({
    legal_name: '',
    display_name: '',
    document_type: 'nit',
    document_number: '',
    company_type: 'client', // fijo — este formulario siempre crea empresas cliente
    person_type: 'juridica',
    address: '',
    phone: '',
    email: '',
    fiscal_address: '',
    fiscal_phone: '',
    fiscal_email: '',
  })

  // Paso 2: Checklist de cumplimiento
  const [checks, setChecks] = useState({}) 
  const [savingChecks, setSavingChecks] = useState(false)

  // Paso 3: Subida de documentos
  const [documentType, setDocumentType] = useState('')
  const [file, setFile] = useState(null)
  const [pendingDocs, setPendingDocs] = useState([])
  const [customDocumentLabel, setCustomDocumentLabel] = useState('')
  // const [uploadedDocs, setUploadedDocs] = useState([])
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const documentTypes = form.person_type === 'natural' ? NATURAL_DOCUMENT_TYPES : JURIDICA_DOCUMENT_TYPES
  const complianceChecks = getComplianceChecks(form.business_sector)

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleCreateCompany = async () => {
    setError('')

    if (!form.legal_name || !form.document_type || !form.document_number || !form.address || !form.phone || !form.email) {
      setError('Todos los campos son obligatorios.')
      return
    }

    if (!isValidPhone(form.phone)) {
      setError('El teléfono debe tener solo números (entre 7 y 15 dígitos)')
      return
    }

    if (!isValidEmail(form.email)) {
      setError('El correo no tiene un formato válido')
      return
    }

    if (!sameAsOperational) {
      if (form.fiscal_phone && !isValidPhone(form.fiscal_phone)) {
        setError('El teléfono fiscal debe tener solo números (entre 7 y 15 dígitos)')
        return
      }
      if (form.fiscal_email && !isValidEmail(form.fiscal_email)) {
        setError('El correo fiscal no tiene un formato válido')
        return
      }
    }

    if (!form.business_sector) {
      setError('Selecciona el sector del cliente.')
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
      setError(getErrorMessage(err, 'No se pudo crear la empresa'))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePhoneChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value.replace(/\D/g, '') })
  }
  
  // Paso 2: Checklist de cumplimiento
  const getCheckState = (key) => checks[key] || { reviewed: false, has_findings: false, note: '' }

  const toggleReviewed = (key) => {
    const current = getCheckState(key)
    setChecks({
      ...checks,
      [key]: { ...current, reviewed: !current.reviewed },
    })
  }

  const toggleFindings = (key) => {
    const current = getCheckState(key)
    setChecks({ 
      ...checks,
      [key]: { ...current, has_findings: !current.has_findings },
    })
  }

  const setNote = (key, note) => {
    const current = getCheckState(key)
    setChecks({
      ...checks,
      [key]: { ...current, note },
    })
  }

  const allChecksReviewed = complianceChecks.every((c) => getCheckState(c.key).reviewed)
  const findingsWithoutNote = complianceChecks.some((c) => getCheckState(c.key).has_findings && !getCheckState(c.key).note.trim())

  const handleSaveChecks = async () => {
    setError('')
    
    if (!allChecksReviewed) {
      setError('Marca todos los checks como revisados antes de continuar.')
      return
    }

    if (findingsWithoutNote) {
      setError('Describe qué se encontró en los puntos marcados con hallazgo')
      return
    }

    setSavingChecks(true)

    try {
      for (const c of complianceChecks) {
        const state = getCheckState(c.key)
        await api.put(`/compliance-checks/company/${companyId}/${c.key}`, {
          has_findings: state.has_findings,
          note: state.has_findings ? state.note: null,
        })
      }
      setStep(3)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron guardar los checks de cumplimiento'))
    } finally {
      setSavingChecks(false)
    }
  }

  // Paso 3: Subida de documentos
  const requiredTypes = form.person_type === 'natural' ? REQUIRED_NATURAL_DOCS : REQUIRED_JURIDICA_DOCS
  const queuedTypes = new Set(pendingDocs.map((d) => d.documentType)) // Documentos en cola
  const missingRequiredDocs = requiredTypes.filter((t) => !queuedTypes.has(t))

  // Para que cuando seleccione un documento, deje de aparecer en el select
  const usedTypes = new Set(pendingDocs.map((d) => d.documentType))
  
  // La opción de "otro" documento siempre queda disponible, porque puede haber más de un documento "personalizado"
  const availableDocumentTypes = documentTypes.filter(
    (t) => t.value === 'otro' || !usedTypes.has(t.value)
  )

  const documentTypeLabel = (value) =>
    documentTypes.find((t) => t.value === value)?.label || value

  // Agrega un documento a la cola de subida
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

    setPendingDocs(failed)
    setUploading(false)

    if (failed.length > 0) {
      setError(`No se pudieron subir: ${failed.map((d) => documentTypeLabel(d.documentType)).join(', ')}. Revisa la lista e intenta de nuevo.`)
      return
    }

    navigate('/companies')
  }


  return (
    <main className="company-form-main">
      <h1 className="company-form-title">Crear empresa</h1>

      <div className="company-form-steps">
        <span className={`company-form-step ${step === 1 ? 'is-active' : 'is-done'}`}>1. Datos</span>
        <span className={`company-form-step ${step === 2 ? 'is-active' : step > 2 ? 'is-done' : ''}`}>2. Verificación</span>
        <span className={`company-form-step ${step === 3 ? 'is-active' : ''}`}>3. Documentos</span>
      </div>

      {error && <div className="company-form-error">{error}</div>}

      {step === 1 && (
        <div className="company-form-card">
          <div className='company-form-row'>
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
              <label className="company-form-label">Sector</label>
              <select
                className="company-form-input"
                value={form.business_sector}
                onChange={handleChange('business_sector')}
              >
                <option value="">Selecciona un sector</option>
                <option value="construccion">Construcción</option>
                <option value="agro">Agro / alimentos</option>
              </select>
            </div>
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

          { form.person_type === 'juridica' ? (
            <div className="company-form-field">
              <label className="company-form-label">Nombre corto (opcional)</label>
              <input
                className="company-form-input"
                value={form.display_name}
                onChange={handleChange('display_name')}
              />
            </div>
          ) : ( null )}

          {form.person_type === 'natural' && (
            <div className="company-form-field">
              <label className="company-form-label">Tipo de documento</label>
              <select
                className="company-form-input"
                value={form.document_type}
                onChange={handleChange('document_type')}
              >
                <option value="">Selecciona un tipo</option>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PP">Pasaporte</option>
                <option value="PPT">Permiso por Protección Temporal</option>
                <option value="PEP">Permiso Especial de Permanencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          )}

          <div className="company-form-row">
            <div className="company-form-field">
              <label className="company-form-label">{form.person_type === 'natural' ? 'Número de documento' : 'NIT'}</label>
              <input
                className="company-form-input"
                value={form.document_number}
                onChange={handleChange('document_number')}
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
                type='number'
                className="company-form-input"
                value={form.phone}
                onChange={handlePhoneChange('phone')}
                inputMode='numeric'
                maxLength={15}
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
            Antes de subir documentos, confirma que revisaste a este cliente en cada una de las siguientes fuentes.
          </p>

          <div className="compliance-checks-list">
            {complianceChecks.map((c) => {
              const state = getCheckState(c.key)
              return (
                <div key={c.key} className="compliance-check-row">
                  <div className="compliance-check-main">
                    <span className="compliance-check-label">{c.label}</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={state.reviewed}
                        onChange={() => toggleReviewed(c.key)}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  {state.reviewed && (
                    <div className="compliance-check-details">
                      <label className="compliance-findings-row">
                        <input
                          type="checkbox"
                          checked={state.has_findings}
                          onChange={() => toggleFindings(c.key)}
                        />
                        ¿Se encontró algo?
                      </label>

                      {state.has_findings && (
                        <textarea
                          className="compliance-note-textarea"
                          placeholder="Describe qué se encontró"
                          value={state.note}
                          onChange={(e) => setNote(c.key, e.target.value)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="company-form-actions">
            <button
              type="button"
              className="company-form-submit-btn"
              onClick={handleSaveChecks}
              disabled={savingChecks || !allChecksReviewed}
            >
              {savingChecks ? 'Guardando...' : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
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
                    <Trash size={16} />
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