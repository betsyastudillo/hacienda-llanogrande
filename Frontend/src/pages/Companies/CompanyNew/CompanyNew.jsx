import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash } from 'lucide-react'
import api from '../../../services/api'
import ComplianceTable from '../../../components/ComplianceTable/ComplianceTable'
import { JURIDICA_DOCUMENT_TYPES, NATURAL_DOCUMENT_TYPES, REQUIRED_JURIDICA_DOCS, REQUIRED_NATURAL_DOCS } from '../../../constants/companyDocuments'
import { getComplianceChecks, getRepComplianceChecks } from '../../../constants/complianceChecks'
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
    document_type: '',
    document_number: '',
    business_sector: '',
    company_type: 'client', // fijo — este formulario siempre crea empresas cliente
    person_type: 'juridica',
    address: '',
    phone: '',
    email: '',
    economic_activity_code: '',
    economic_activity_description: '',
    fiscal_address: '',
    fiscal_phone: '',
    fiscal_email: '',
    legal_rep_name: '',
    legal_rep_document_type: '',
    legal_rep_document_number: '',
    legal_rep_email: '',
    legal_rep_city: '',
  })

  // Paso 2: Checklist de cumplimiento
  const [companyChecks, setCompanyChecks] = useState({})
  const [repChecks, setRepChecks] = useState({})
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

  const { companyId: resumeId } = useParams()
  const [loadingResume, setLoadingResume] = useState(Boolean(resumeId))
  const [uploadedDocs, setUploadedDocs] = useState([])

  const documentTypes = form.person_type === 'natural' ? NATURAL_DOCUMENT_TYPES : JURIDICA_DOCUMENT_TYPES

  // Este se utiliza en caso que haya quedado la empresa en borrador, es decir se creó pero no se agregaron documentos ni la verificación en listas vinculantes.
  useEffect(() => {
    if (!resumeId) return

    async function loadDraft() {
      try {
        const [companyRes, checksRes, docsRes] = await Promise.all([
          api.get(`/companies/${resumeId}`),
          api.get(`/compliance-checks/company/${resumeId}`),
          api.get(`/documents/?company_id=${resumeId}`),
        ])
        const c = companyRes.data

        if (c.verification_status !== 'draft') {
          navigate(`/companies/${resumeId}`)
          return
        }

        setCompanyId(resumeId)
        setForm((prev) => ({
          ...prev,
          legal_name: c.legal_name,
          person_type: c.person_type,
          business_sector: c.business_sector || '',
        }))

        // Se reparten las verificaciones guardadas según el sujeto
        const loadedCompany = {}
        const loadedRep = {}
        checksRes.data.forEach((ch) => {
          const value = { has_findings: ch.has_findings, note: ch.note || '' }
          if ((ch.subject || 'company') === 'legal_representative') {
            loadedRep[ch.check_key] = value
          } else {
            loadedCompany[ch.check_key] = value
          }
        })

        setCompanyChecks(loadedCompany)
        setRepChecks(loadedRep)
        setUploadedDocs(docsRes.data)

        const juridica = c.person_type === 'juridica'
        const companyDone = getComplianceChecks(c.business_sector).every((x) => loadedCompany[x.key])
        const repDone = !juridica || getRepComplianceChecks().every((x) => loadedRep[x.key])

        setStep(companyDone && repDone ? 3 : 2)

      } catch (err) {
        setError(getErrorMessage(err, 'No se pudo cargar el borrador'))
      } finally {
        setLoadingResume(false)
      }
    }

    loadDraft()
  }, [resumeId])

  const isJuridica = form.person_type === 'juridica'
  const companyItems = getComplianceChecks(form.business_sector)
  const repItems = getRepComplianceChecks()

  const isAnswered = (items, values) =>
    items.every(({ key }) => {
      const v = values[key]
      return v && typeof v.has_findings === 'boolean' && (!v.has_findings || v.note?.trim())
    })

  const allChecksReviewed = isAnswered(companyItems, companyChecks) && (!isJuridica || isAnswered(repItems, repChecks))

  const patchChecks = (setter) => (key, patch) =>
    setter((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
  }

  const handleCreateCompany = async () => {
    setError('')

    const isJuridica = form.person_type === 'juridica'

    if (
      !form.legal_name.trim() || !form.document_number.trim() ||
      !form.address.trim() || !form.phone || !form.email.trim() ||
      (!isJuridica && !form.document_type)
    ) {
      setError('Todos los campos son obligatorios.')
      return
    }

    if (!form.business_sector) {
      setError('Selecciona el sector del cliente.')
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

    if (form.economic_activity_code && !/^\d{4}$/.test(form.economic_activity_code)) {
      setError('El código CIIU debe tener 4 dígitos')
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

    if (isJuridica) {
      if (
        !form.legal_rep_name.trim() || !form.legal_rep_document_type ||
        !form.legal_rep_document_number.trim() || !form.legal_rep_email.trim() ||
        !form.legal_rep_city.trim()
      ) {
        setError('Completa todos los datos del representante legal.')
        return
      }
      if (!isValidEmail(form.legal_rep_email)) {
        setError('El correo del representante legal no tiene un formato válido')
        return
      }
    }


    setSubmitting(true)
    
    try {
      const clean = (v) => (typeof v === 'string' ? v.trim() : v) || null

      const payload = {
        ...form,
        legal_name: form.legal_name.trim(),
        document_number: form.document_number.trim(),
        address: form.address.trim(),
        email: form.email.trim(),

        document_type: isJuridica ? 'NIT' : form.document_type,
        display_name: isJuridica ? clean(form.display_name) : null,

        economic_activity_code: clean(form.economic_activity_code),
        economic_activity_description: clean(form.economic_activity_description),

        fiscal_address: sameAsOperational ? null : clean(form.fiscal_address),
        fiscal_phone: sameAsOperational ? null : clean(form.fiscal_phone),
        fiscal_email: sameAsOperational ? null : clean(form.fiscal_email),

        legal_rep_name: isJuridica ? form.legal_rep_name.trim() : null,
        legal_rep_document_type: isJuridica ? form.legal_rep_document_type : null,
        legal_rep_document_number: isJuridica ? form.legal_rep_document_number.trim() : null,
        legal_rep_email: isJuridica ? form.legal_rep_email.trim() : null,
        legal_rep_city: isJuridica ? form.legal_rep_city.trim() : null,
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
  const handleSaveChecks = async () => {
    setError('')
    setSavingChecks(true)

    try {
      const jobs = [
        ...companyItems.map(({ key }) => ({ subject: 'company', key, v: companyChecks[key] })),
        ...(isJuridica ? repItems.map(({ key }) => ({ subject: 'legal_representative', key, v: repChecks[key] })) : []),
      ]

      await Promise.all(
        jobs.map(({ subject, key, v }) =>
          api.put(
            `/compliance-checks/company/${companyId}/${key}`,
            { has_findings: v.has_findings, note: v.note?.trim() || null },
            { params: { subject } },
          ),
        ),
      )
      setStep(3)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo guardar la verificación'))
    } finally {
      setSavingChecks(false)
    }
  }

  // Paso 3: Subida de documentos  
  const requiredTypes = form.person_type === 'natural' ? REQUIRED_NATURAL_DOCS : REQUIRED_JURIDICA_DOCS
  const uploadedTypes = new Set(uploadedDocs.map((d) => d.document_type)) // Si ya tenía docs guardados antes
  const queuedTypes = new Set(pendingDocs.map((d) => d.documentType)) // Documentos en cola
  const missingRequiredDocs = requiredTypes.filter((t) => !queuedTypes.has(t) && !uploadedTypes.has(t))

  // Para que cuando seleccione un documento, deje de aparecer en el select
  const usedTypes = new Set([...queuedTypes, ...uploadedTypes])
  
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
  
    setUploadedDocs((prev) => [...prev, ...succeeded])
    setPendingDocs(failed)

    if (failed.length > 0) {
      setError(`No se pudieron subir: ${failed.map((d) => documentTypeLabel(d.documentType)).join(', ')}. Revisa la lista e intenta de nuevo.`)
      setUploading(false)

      return
    }

    try {
      await api.patch(`/companies/${companyId}/submit`)
      navigate('/companies')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo enviar la empresa a revisión'))
    } finally {
      setUploading(false)
    }
  }


  if (loadingResume) return <main className="company-form-main"><p>Cargando...</p></main>



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

          <div className="company-form-row">
            <div className="company-form-field">
              <label className="company-form-label">Código CIIU</label>
              <input
                className="company-form-input"
                value={form.economic_activity_code}
                onChange={handleChange('economic_activity_code')}
                inputMode="numeric"
                maxLength={4}
                placeholder="ej. 4752"
              />
            </div>

            <div className="company-form-field">
              <label className="company-form-label">Actividad económica</label>
              <input
                className="company-form-input"
                value={form.economic_activity_description}
                onChange={handleChange('economic_activity_description')}
                placeholder="ej. Comercio al por menor"
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
                  <label className="company-form-label">Correo notificaciones</label>
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

          {form.person_type === 'juridica' && (
            <>
            <p className="company-form-section-title">Datos del representante legal</p>
            <div className="company-form-field">
              <label className="company-form-label">Nombre completo</label>
              <input
                className="company-form-input"
                value={form.legal_rep_name}
                onChange={handleChange('legal_rep_name')}
              />
            </div>
            
            <div className='company-form-row'>
              <div className="company-form-field">
                <label className="company-form-label">Tipo de documento</label>
                <select
                  className="company-form-input"
                  value={form.legal_rep_document_type}
                  onChange={handleChange('legal_rep_document_type')}
                >
                  <option value="">Selecciona un tipo</option>
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="CE">Cédula de extranjería</option>
                  <option value="PP">Pasaporte</option>
                  <option value="PPT">Permiso por Protección Temporal</option>
                  <option value="PEP">Permiso Especial de Permanencia</option>
                </select>
              </div>

              <div className="company-form-field">
                <label className="company-form-label">Número de documento</label>
                <input
                  className="company-form-input"
                  value={form.legal_rep_document_number}
                  onChange={handleChange('legal_rep_document_number')}
                />
              </div>
            </div>

            <div className="company-form-row">
              <div className="company-form-field">
                <label className="company-form-label">Correo</label>
                <input
                  type="email"
                  className="company-form-input"
                  value={form.legal_rep_email}
                  onChange={handleChange('legal_rep_email')}
                />
              </div>

              <div className="company-form-field">
                <label className="company-form-label">Ciudad</label>
                <input
                  className="company-form-input"
                  value={form.legal_rep_city}
                  onChange={handleChange('legal_rep_city')}
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
            Antes de subir documentos, indica el resultado de la consulta en cada fuente.
          </p>

          <ComplianceTable
            title={isJuridica ? 'Empresa' : null}
            group="company"
            items={companyItems}
            values={companyChecks}
            onChange={patchChecks(setCompanyChecks)}
          />

          {isJuridica && (
            <ComplianceTable
              title="Representante legal"
              group="legal_rep"
              items={repItems}
              values={repChecks}
              onChange={patchChecks(setRepChecks)}
            />
          )}

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

          {uploadedDocs.length > 0 && (
            <div className="company-form-queue-list">
              <p className="company-form-uploaded-title">Documentos ya cargados</p>
              {uploadedDocs.map((doc) => (
                <div key={doc.id} className="company-form-queue-row">
                  <span>{documentTypeLabel(doc.document_type)}</span>
                </div>
              ))}
            </div>
          )}

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