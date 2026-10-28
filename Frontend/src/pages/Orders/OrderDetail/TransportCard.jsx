import { useState } from 'react'
import { CircleCheck, CircleX, Clock, Eye, Upload, Check, X } from 'lucide-react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import Modal from '../../../components/Modal/Modal'
import StatusBadge from '../../../components/StatusBadge/StatusBadge'
import FilePreviewModal from '../../../components/FilePreviewModal/FilePreviewModal'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { 
    TRANSPORT_DOCS, CARRIER_DOCUMENT_TYPES, OWNER_DOCUMENT_TYPES, VEHICLE_TYPES, vehicleTypeLabel, TRANSPORT_CHECK_LABELS, TRANSPORT_CHECK_SUBJECTS
} from '../../../constants/transport'
import CollapsibleCard from '../../../components/CollapsibleCard/CollapsibleCard'
import TransportDocuments from './TransportDocuments'
import ComplianceTable from '../../../components/ComplianceTable/ComplianceTable'


const STATUS = {
  pending: { label: 'Pendiente de validación', icon: Clock, bg: '#fdf1b8', text: '#7a5c00' },
  approved: { label: 'Aprobado', icon: CircleCheck, bg: '#d9efdc', text: '#1f6b34' },
  rejected: { label: 'Rechazado', icon: CircleX, bg: '#fbdcdc', text: '#a12a2a' },
}

const EMPTY_FORM = {
  plate: '', type: '', capacity_m3: '',
  owner_name: '', owner_document_type: 'CC', owner_document_id: '', owner_phone: '',
  full_name: '', document_type: 'CC', document_id: '', phone: '', address: '',
}

const DOC_STATUS = {
  missing: { label: 'Falta', icon: null, bg: '#ece9e2', text: '#5f5e5a' },
  pending: { label: 'En revisión', icon: Clock, bg: '#fdf1b8', text: '#7a5c00' },
  approved: { label: 'Aprobado', icon: CircleCheck, bg: '#d9efdc', text: '#1f6b34' },
  rejected: { label: 'Rechazado', icon: CircleX, bg: '#fbdcdc', text: '#a12a2a' },
}

const SUBJECT_ORDER = ['vehicle', 'owner', 'carrier']


export default function TransportCard({ order, assignment, dispatchGuide, onChanged, defaultOpen }) {
  const { hasPermission } = useAuth()
  const { showToast } = useToast()
  
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [ownerIsCarrier, setOwnerIsCarrier] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [checked, setChecked] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [blacklist, setBlacklist] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(null)
  const [hint, setHint] = useState({ vehicle: false, carrier: false, owner: false })
  const [blocked, setBlocked] = useState({ vehicle: null, carrier: false, owner: false })
  
  const [docToReject, setDocToReject] = useState(null)   // { doc, label }
  const [docReason, setDocReason] = useState('')
  const [checkValues, setCheckValues] = useState({})   // { 'vehicle:simit': { has_findings, note } }

  const isBusy = busy !== null
  
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const setDigits = (f) => (e) => setForm({ ...form, [f]: e.target.value.replace(/\D/g, '') })
  
  const canValidate = hasPermission('assignment:validar')
  const canGuide = hasPermission('dispatch_guide:crear')
  const canSubmit = hasPermission('assignment:crear_propio') && !hasPermission('assignment:validar')
  const canFix = canSubmit && assignment?.validation_status === 'rejected'
  const canDecide = canValidate && assignment?.validation_status === 'pending'
  const canMakeGuide =
  canGuide && assignment?.validation_status === 'approved' &&
  order.status === 'transport_validated' && !dispatchGuide
  const canUpload = canSubmit && !canValidate && assignment && assignment.validation_status !== 'approved'

  // Ejecuta una acción mostrando el resultado y recargando el pedido
  // onError: si se pasa, el error se muestra donde se indique (dentro de un modal) y no como popup.
  async function run(name, action, okMessage, errorMessage, after, onError) {
    setBusy(name)
    // Se coloca el nombre para distinguir qué se está haciendo, por el tema del botón de aprobar que solo cambie cuando se mande a aprobar y no cuando se están cargando los documentos
    try {
      await action()
      showToast(okMessage)
      after?.()
      await onChanged()
    
    } catch (err) {
      const message = getErrorMessage(err, errorMessage)
      if (onError) onError(message)
      else showToast(message, 'error')
    
    } finally {
      setBusy(null)
    }
  }

  function openForm() {
    setFormError('')

    if (assignment) {
      const v = assignment.vehicle
      const c = assignment.carrier

      setOwnerIsCarrier(sameOwner)

      setForm({
        plate: v.plate,
        type: v.type,
        capacity_m3: String(v.capacity_m3),
        owner_name: v.owner_name || '',
        owner_document_type: v.owner_document_type || 'CC',
        owner_document_id: v.owner_document_id || '',
        owner_phone: v.owner_phone || '',
        full_name: c.full_name,
        document_type: c.document_type,
        document_id: c.document_id,
        phone: c.phone || '',
        address: c.address || ''
      })
    } else {
      setOwnerIsCarrier(false)
      setForm(EMPTY_FORM)
    }

    // Se reinician siempre al abrir el formulario
    setHint({vehicle: false, carrier: false, owner: false})
    setBlocked({
      vehicle: vehicleBlocked ? 'vehicle' : null,
      carrier: carrierBlocked,
      owner: ownerBlocked,
    })
    setShowForm(true)
  }

  async function lookupOwner() {
    const id = form.owner_document_id.trim()
    if (id.length < 5) return

    try {
      const { data } = await api.get('/assignments/lookup/owner', {
        params: { document_type: form.owner_document_type, document_id: id },
      })

      if (data.status === 'blocked') {
        setBlocked((b) => ({ ...b, owner: true }))
        return setHint((h) => ({ ...h, owner: false }))
      }
      setBlocked((b) => ({ ...b, owner: false }))

      if (data.status !== 'found') return setHint((h) => ({ ...h, owner: false }))

      setForm((f) => ({ ...f, owner_name: data.owner_name || '', owner_phone: data.owner_phone || '' }))
      setHint((h) => ({ ...h, owner: true }))
    } catch {
      setBlocked((b) => ({ ...b, owner: false }))
      setHint((h) => ({ ...h, owner: false }))
    }
  }

  async function lookupVehicle() {
    
    const plate = form.plate.trim()
    
    if (plate.length < 5) return
    // Al corregir un rechazo, si la placa no cambió, ya está cargada
    if (assignment && !vehicleBlocked && plate === assignment.vehicle.plate) return

    try {
      const { data } = await api.get('/assignments/lookup/vehicle', { params: { plate } })

      if (data.status === 'blocked') {
        setBlocked((b) => ({ ...b, vehicle: data.subject }))
        return setHint((h) => ({ ...h, vehicle: false }))
      }
      setBlocked((b) => ({ ...b, vehicle: null }))

      if (data.status !== 'found') return setHint((h) => ({ ...h, vehicle: false }))

      const v = data.vehicle
      setForm((f) => ({
        ...f,
        type: v.type,
        capacity_m3: String(v.capacity_m3),
        owner_name: v.owner_name || '',
        owner_document_type: v.owner_document_type || 'CC',
        owner_document_id: v.owner_document_id || '',
        owner_phone: v.owner_phone || '',
      }))
      setOwnerIsCarrier(false)
      setHint((h) => ({ ...h, vehicle: true }))

    } catch {
      setBlocked((b) => ({ ...b, vehicle: null }))
      setHint((h) => ({ ...h, vehicle: false }))
    }
  }

  async function lookupCarrier() {
  
    const id = form.document_id.trim()
    if (id.length < 5) return
    if (assignment && !carrierBlocked && id === assignment.carrier.document_id && form.document_type === assignment.carrier.document_type) return

    try {
      const { data } = await api.get('/assignments/lookup/carrier', {
        params: { document_type: form.document_type, document_id: id },
      })

      if (data.status === 'blocked') {
        setBlocked((b) => ({ ...b, carrier: true }))
        return setHint((h) => ({ ...h, carrier: false }))
      }

      setBlocked((b) => ({ ...b, carrier: false }))

      if (data.status !== 'found') return setHint((h) => ({ ...h, carrier: false }))

      const c = data.carrier

      setForm((f) => ({ ...f, full_name: c.full_name, phone: c.phone || '', address: c.address || '' }))
      setHint((h) => ({ ...h, carrier: true }))
    } catch {
      setBlocked((b) => ({ ...b, carrier: false }))
      setHint((h) => ({ ...h, carrier: false }))
    }
  }
  
  function handleSubmit() {
    const owner = ownerIsCarrier 
      ? { name: form.full_name, type: form.document_type, id: form.document_id, phone: form.phone }
      : { name: form.owner_name, type: form.owner_document_type, id: form.owner_document_id, phone: form.owner_phone }

    if (!form.plate.trim() || !form.type || !(Number(form.capacity_m3) > 0))
      return setFormError('Completa la placa, el tipo y la capacidad del vehículo.')

    if (!owner.name.trim() || !owner.id.trim())
      return setFormError('Completa los datos del dueño del vehículo.')

    if (!form.full_name.trim() || !form.document_id.trim() || !form.address.trim())
      return setFormError('Completa el nombre, el documento y la dirección del transportador.')

    if (!/^\d{7,15}$/.test(form.phone))
      return setFormError('El teléfono del transportador debe tener entre 7 y 15 dígitos.')

    setFormError('')

    const body = {
      vehicle: {
        plate: form.plate.trim(),
        type: form.type,
        capacity_m3: Number(form.capacity_m3),
        owner_name: owner.name.trim(),
        owner_document_type: owner.type,
        owner_document_id: owner.id.trim(),
        owner_phone: owner.phone.trim() || null,
      },
      carrier: {
        full_name: form.full_name.trim(),
        document_type: form.document_type,
        document_id: form.document_id.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      },
    }

    run( 'submit',
      () => (assignment 
        ? api.put(`/assignments/order/${order.id}/resubmit`, body)
        : api.post('/assignments/', { order_id: order.id, ...body })),
      assignment ? 'Datos corregidos y reenviados a logística.' : 'Datos enviados. Ahora sube los documentos.',
      'No se pudo enviar el transporte',
      () => setShowForm(false),
      setFormError
    )
  }

  function handleUpload(key, file) {
    if (!file) return
    const [subject, documentType] = key.split(':')

    const formData = new FormData()
    formData.append('subject', subject)
    formData.append('document_type', documentType)
    formData.append('file', file)
    
    run('upload',
      () => api.post(`/assignments/order/${order.id}/documents`, formData),
      'Documento subido.',
      'No se pudo subir el documento')
  }

  function handleApprove() {
    run('approved',
      () => api.patch(`/assignments/${assignment.id}/validate`, {
        decision: 'approved',
        rejection_reason: null,
        background_check_verified: true,
        blacklist_carrier: false,
        checks: Object.entries(checkValues).map(([full, val]) => {
          const [subject, check_key] = full.split(':')
          return { subject, check_key, has_findings: val.has_findings, note: val.note?.trim() || null }
        }),
      }),
      'Transporte aprobado.',
      'No se pudo aprobar el transporte',
      () => setShowApprove(false)
    )
  }

  function handleApproveAll() {
    const pending = docRows.filter((r) => r.status === 'pending').map((r) => r.doc)

    run(
      'review-all',
      async () => {
        try {
          for (const doc of pending) {
            await api.patch(`/assignments/order/${order.id}/documents/${doc.id}/review`, { status: 'approved', reason: null })
          }
        } finally {
          await onChanged()   // si algo falla a medias, la pantalla refleja los que sí quedaron
        }
      },
      `${pending.length} documentos aprobados.`,
      'No se pudieron aprobar todos los documentos'
    )
  }

  function handleReviewDoc(doc, status, reason = null) {
    run(
      'review',
      () => api.patch(`/assignments/order/${order.id}/documents/${doc.id}/review`, { status, reason }),
      status === 'approved' ? 'Documento aprobado.' : 'Documento rechazado.',
      'No se pudo revisar el documento',
      () => setDocToReject(null)
    )
  }

  function openRejectDoc(doc, label) {
    setDocReason('')
    setDocToReject({ doc, label })
  }

  function handleReject() {
    run('reject',
      () => api.patch(`/assignments/${assignment.id}/validate`, {
        decision: 'rejected',
        rejection_reason: reason.trim(),
        background_check_verified: false,
        blacklist_carrier: blacklist,
      }),
      'Transporte rechazado.',
      'No se pudo rechazar el transporte',
      () => setShowReject(false)
    )
  }

  function handleCreateGuide() {
    run('guide',
      () => api.post('/dispatch-guides/', { order_id: order.id }),
      'Guía de despacho generada.',
      'No se pudo generar la guía'
    )
  }

  function openPreview(label, doc) {
    setPreview({
      title: label,
      apiPath: `/assignments/order/${order.id}/documents/${doc.id}/file`,
    })
  }

  const v = assignment?.vehicle
  const c = assignment?.carrier
  
  const blockedList = assignment?.blocked || []
  const carrierBlocked = blockedList.includes('carrier')
  const vehicleBlocked = blockedList.includes('vehicle')
  const ownerBlocked = blockedList.includes('owner')

  // Qué está vetado, en palabras (sin el motivo del veto, que es interno)
  const blockedWhat = [
    vehicleBlocked && 'el vehículo',
    ownerBlocked && 'su propietario',
    carrierBlocked && 'el transportador',
  ].filter(Boolean).join(', ')

  // El dueño y el transportador son la misma persona si tienen el mismo documento
  const sameOwner = Boolean(
    v?.owner_document_id &&
    v.owner_document_id === c?.document_id &&
    v.owner_document_type === c?.document_type
  )

  const missing = assignment?.missing_documents || []
  const status = assignment ? STATUS[assignment.validation_status] || STATUS.pending : null

  const ownerDocLabel = v?.owner_document_type === 'NIT' ? 'RUT del propietario' : 'Cédula del propietario'

  // Un documento subido o faltante, por cada uno de los 4 requeridos
  const docRows = Object.entries(TRANSPORT_DOCS)
  .filter(([key]) => !(sameOwner && key === 'vehicle:documento_propietario'))
  .map(([key, baseLabel]) => {
    const label = key === 'vehicle:documento_propietario' ? ownerDocLabel : baseLabel
    const [subject, documentType] = key.split(':')
    const doc = assignment?.documents?.find(
      (d) => d.document_type === documentType && (subject === 'vehicle' ? d.vehicle_id : d.carrier_id)
    )
    return { key, label, doc, status: doc ? doc.status : 'missing' }
  })

  const checkItems = (assignment?.required_checks || []).map((full) => {
    const [subject, key] = full.split(':')
    return { full, subject, key }
  })

  // Qué dato se consulta en cada portal, para copiarlo
  const checkTarget = {
    vehicle: v ? `Placa ${v.plate}` : '',
    owner: v ? `${v.owner_document_type} ${v.owner_document_id}` : '',
    carrier: c ? `${c.document_type} ${c.document_id}` : '',
  }

  const checksComplete = checkItems.every(({ full }) => {
    const val = checkValues[full]
    return val && typeof val.has_findings === 'boolean' && (!val.has_findings || val.note?.trim())
  })

  const hasFindings = Object.values(checkValues).some((val) => val.has_findings)

  // Hallazgos ya registrados: los ve también el cliente
  const findings = (assignment?.checks || []).filter((ch) => ch.has_findings)

  // Falta algún documento o alguno no está aprobado todavía
  const docsUnapproved = docRows.some((r) => r.status !== 'approved')
  
  return (
    <>
      <CollapsibleCard
        title="Transporte"
        summary={status ? status.label : 'Sin enviar'}
        defaultOpen={defaultOpen}
      >
        {!assignment ? (
          <>
            <p className="detail-empty-inline">
              {order.status === 'facturado'
                ? 'Aún no se ha enviado la información de transporte.'
                : 'El transporte se envía una vez el pedido esté facturado.'}
            </p>
            {order.status === 'facturado' && canSubmit && (
              <div className="pay-actions">
                <button className="pay-btn is-primary" onClick={openForm}>Enviar datos de transporte</button>
              </div>
            )}
          </>
        ) : (
          <>
            {assignment.blocked?.length > 0 && assignment.validation_status !== 'approved' && (
              <p className="detail-error-text">
                {canValidate
                  ? `Atención: ${blockedWhat} figura en la lista de vetados. No se puede aprobar este transporte.`
                  : `No está autorizado: ${blockedWhat}. Corrige los datos y reenvía, o comunícate con el área de Logística.`}
              </p>
            )}

            {findings.length > 0 && (
              <div className="detail-error-text">
                <strong>Hallazgos en la verificación:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {findings.map((ch) => (
                    <li key={`${ch.subject}:${ch.check_key}`}>
                      {TRANSPORT_CHECK_SUBJECTS[ch.subject]} · {TRANSPORT_CHECK_LABELS[ch.check_key]}: {ch.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="detail-info-list">
              <div className="detail-info-row">
                <span>Estado</span>
                <StatusBadge label={status.label} bgColor={status.bg} textColor={status.text} icon={status.icon} />
              </div>
              <div className="detail-info-row">
                <span>Placa</span>
                <span>{assignment.vehicle.plate}</span>
              </div>
              <div className="detail-info-row">
                <span>Tipo</span>
                <span>{vehicleTypeLabel(assignment.vehicle.type)}</span>
              </div>
              <div className="detail-info-row">
                <span>Capacidad</span>
                <span>{assignment.vehicle.capacity_m3}</span>
              </div>
  
              {sameOwner ? (
                <>
                  <div className="detail-info-row"><span>Transportador y dueño</span><span>{c.full_name}</span></div>
                  <div className="detail-info-row"><span>Documento</span><span>{c.document_type} {c.document_id}</span></div>
                  <div className="detail-info-row"><span>Teléfono</span><span>{c.phone}</span></div>
                </>
              ) : (
                <>
                  <div className="detail-info-row"><span>Dueño</span><span>{v.owner_name || '—'}</span></div>
                  <div className="detail-info-row">
                    <span>Documento del dueño</span>
                    <span>{v.owner_document_type ? `${v.owner_document_type} ${v.owner_document_id}` : '—'}</span>
                  </div>
                  {v.owner_phone && (
                    <div className="detail-info-row"><span>Teléfono del dueño</span><span>{v.owner_phone}</span></div>
                  )}
                  <div className="detail-info-row"><span>Transportador</span><span>{c.full_name}</span></div>
                  <div className="detail-info-row"><span>Documento</span><span>{c.document_type} {c.document_id}</span></div>
                  <div className="detail-info-row"><span>Teléfono</span><span>{c.phone}</span></div>
                </>
              )}
  
              {assignment.validation_status === 'rejected' && assignment.rejection_reason && (
                <div className="detail-info-row">
                  <span>Motivo</span><span className="pay-reason">{assignment.rejection_reason}</span>
                </div>
              )}
            </div>
  
            <TransportDocuments
              rows={docRows}
              canReview={canValidate && assignment.validation_status === 'pending'}
              canUpload={canUpload}
              isBusy={isBusy}
              busy={busy}
              onView={openPreview}
              onUpload={handleUpload}
              onApprove={(doc) => handleReviewDoc(doc, 'approved')}
              onReject={openRejectDoc}
              onApproveAll={handleApproveAll}
            />
  
            {busy === 'upload' && <p className="detail-empty-inline pay-hint">Subiendo documento...</p>}
  
            {canUpload && docRows.some((r) => r.status === 'rejected') && (
              <p className="detail-empty-inline pay-hint">Reemplaza los documentos rechazados; el área encargada los revisará de nuevo.</p>
            )}

            {canUpload && missing.length > 0 && !docRows.some((r) => r.status === 'rejected') && (
              <p className="detail-empty-inline pay-hint">Sube los documentos que faltan (PDF o imagen, máximo 5 MB).</p>
            )}

            {canDecide && docRows.some((r) => r.status === 'rejected') && (
              <p className="detail-empty-inline pay-hint">
                Hay documentos rechazados: el cliente debe reemplazarlos para poder aprobar el transporte.
              </p>
            )}
            {canDecide && !docRows.some((r) => r.status === 'rejected') && docsUnapproved && missing.length === 0 && (
              <p className="detail-empty-inline pay-hint">Aprueba o rechaza cada documento antes de aprobar el transporte.</p>
            )}
  
            {assignment.validation_status === 'pending' && !canValidate && missing.length === 0 && (
              <p className="detail-empty-inline pay-hint">En revisión por logística.</p>
            )}
  
            {canFix && (
              <div className="pay-actions">
                <button className="pay-btn is-primary" onClick={openForm}>Corregir datos</button>
              </div>
            )}
  
            {canDecide && (
              <div className="pay-decision">
                <button 
                  className="pay-btn is-danger" 
                  onClick={() => { setReason(''); setBlacklist(false); setShowReject(true) }}
                  disabled={isBusy}
                >
                  Rechazar
                </button>
  
                <button
                  className="pay-btn is-primary"
                  onClick={() => { setCheckValues({}); setShowApprove(true) }}
                  disabled={isBusy || docsUnapproved || assignment.blocked?.length > 0}
                  title={docsUnapproved ? 'Aprueba cada documento primero' : undefined}
                >
                  Siguiente
                </button>
              </div>
            )}
  
            {canMakeGuide && (
              <div className="pay-actions">
                <button
                  type='button'
                  className="pay-btn is-primary" 
                  disabled={isBusy}
                  onClick={handleCreateGuide}
                >
                  Generar guía de despacho
                </button>
              </div>
            )}
          </>
        )}
      </CollapsibleCard>

      {showForm && (
        <Modal title={assignment ? 'Corregir datos de transporte' : 'Datos de transporte'} onClose={() => setShowForm(false)}>
          <div className="edit-form">
            <p className="edit-section">Vehículo</p>
      
            <div className="edit-row">
              <label className="edit-field">Placa
                <input
                  value={form.plate}
                  onChange={(e) => {
                    setForm({ ...form, plate: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
                    setHint((h) => ({ ...h, vehicle: false }))
                    setBlocked((b) => ({ ...b, vehicle: null }))
                  }}
                  onBlur={lookupVehicle}
                  maxLength={6}
                />
              </label>
      
              <label className="edit-field">Tipo
                <select value={form.type} onChange={set('type')}>
                  <option value="">Selecciona</option>
                  {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
      
            {hint.vehicle && (
              <p className="edit-note">Datos cargados de un registro anterior. Revísalos y corrígelos si algo cambió.</p>
            )}
      
            {blocked.vehicle && (
              <p className="pay-error">
                {blocked.vehicle === 'owner' ? 'El dueño de este vehículo' : 'Este vehículo'} no está autorizado para
                realizar el transporte. Si tienes dudas, comunícate con Logística.
              </p>
            )}
      
            <label className="edit-field">Capacidad (m³)
              <input type="number" min="0" value={form.capacity_m3} onChange={set('capacity_m3')} />
            </label>
      
            <p className="edit-section">Dueño del vehículo</p>
            <label style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={ownerIsCarrier} onChange={(e) => setOwnerIsCarrier(e.target.checked)} />
              El transportador es el dueño del vehículo
            </label>

            {!ownerIsCarrier && (
              <>
                <div className="edit-row">
                  <label className="edit-field">Tipo de documento
                    <select
                      value={form.owner_document_type}
                      placeholder={form.owner_document_type === 'NIT' ? 'NIT sin dígito de verificación' : ''}
                      onChange={(e) => {
                        const value = form.owner_document_type === 'NIT' ? e.target.value.replace(/\D/g, '') : e.target.value
                        setForm({...form, owner_document_id: value})
                        setHint((h) => ({ ...h, owner: false }))
                        setBlocked((b) => ({ ...b, owner: false }))
                      }}
                      onBlur={lookupOwner}
                    >
                      {OWNER_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="edit-field">Número
                    <input
                      value={form.owner_document_id}
                      onChange={(e) => {
                        set('owner_document_id')(e)
                        setHint((h) => ({ ...h, owner: false }))
                        setBlocked((b) => ({ ...b, owner: false }))
                      }}
                      onBlur={lookupOwner}
                    />
                  </label>
                </div>
      
                {hint.owner && (
                  <p className="edit-note">Datos cargados de un registro anterior. Revísalos y corrígelos si algo cambió.</p>
                )}
                {blocked.owner && (
                  <p className="pay-error">
                    Este propietario no está autorizado para realizar el transporte. Si tienes dudas, comunícate con Logística.
                  </p>
                )}
      
                <label className="edit-field">Nombre o razón social
                  <input value={form.owner_name} onChange={set('owner_name')} />
                </label>
      
                <label className="edit-field">Teléfono (opcional)
                  <input value={form.owner_phone} onChange={setDigits('owner_phone')} maxLength={15} inputMode="numeric" />
                </label>
              </>
            )}
      
            <p className="edit-section">Transportador</p>
            <div className="edit-row">
              <label className="edit-field">Tipo de documento
                <select
                  value={form.document_type}
                  onChange={(e) => { set('document_type')(e); setHint((h) => ({ ...h, carrier: false })) }}
                  onBlur={lookupCarrier}
                >
                  {CARRIER_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="edit-field">Número
                <input
                  value={form.document_id}
                  onChange={(e) => { 
                    set('document_id')(e); 
                    setHint((h) => ({ ...h, carrier: false }))
                    setBlocked((b) => ({ ...b, carrier: false }))
                  }}
                  onBlur={lookupCarrier}
                />
              </label>
            </div>

            {blocked.carrier && (
              <p className="detail-error-text">
                Este transportador no está autorizado para realizar el transporte. Si tienes dudas, comunícate con el área de Logística.
              </p>
            )}
      
            {hint.carrier && (
              <p className="edit-note">Datos cargados de un registro anterior. Revísalos y corrígelos si algo cambió.</p>
            )}
      
            <label className="edit-field">Nombre completo
              <input value={form.full_name} onChange={set('full_name')} />
            </label>
            <div className="edit-row">
              <label className="edit-field">Teléfono
                <input value={form.phone} onChange={setDigits('phone')} maxLength={15} inputMode="numeric" />
              </label>
              <label className="edit-field">Dirección
                <input value={form.address} onChange={set('address')} maxLength={200} />
              </label>
            </div>
          </div>
      
          {formError && <p className="detail-error-text">{formError}</p>}
      
          <div className="pay-actions">
            <button 
              type="button" 
              className="pay-btn" 
              onClick={() => setShowForm(false)} 
              disabled={isBusy}
            >
              Cancelar
            </button>
            
            <button 
              type="button" 
              className="pay-btn is-primary" 
              onClick={handleSubmit} 
              disabled={busy || Boolean(blocked.vehicle) || blocked.carrier || blocked.owner}
            >
              {busy === 'submit' ? 'Enviando...' : assignment ? 'Reenviar' : 'Enviar'}
            </button>
          
          </div>
        </Modal>
      )}
      
      {showApprove && (
        <Modal title="Verificar y aprobar transporte" onClose={() => setShowApprove(false)}>
          <p className="edit-note">
            Consulta cada fuente con el dato indicado y registra el resultado.
          </p>

          {SUBJECT_ORDER.map((s) => {
            const items = checkItems
              .filter((i) => i.subject === s)
              .map((i) => ({ key: i.full, label: TRANSPORT_CHECK_LABELS[i.key] || i.key }))

            if (items.length === 0) return null

            return (
              <ComplianceTable
                key={s}
                group={s}
                title={`${TRANSPORT_CHECK_SUBJECTS[s]} · ${checkTarget[s]}`}
                items={items}
                values={checkValues}
                onChange={(key, patch) => setCheckValues((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))}
              />
            )
          })}

          {hasFindings && (
            <p className="detail-empty-inline pay-hint">Si hay hallazgos: se registran y se le avisará al cliente.</p>
          )}

          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setShowApprove(false)} disabled={isBusy}>Cancelar</button>
            <button type="button" className="pay-btn is-primary" disabled={!checksComplete || isBusy} onClick={handleApprove}>
              {busy === 'approved' ? 'Aprobando...' : 'Aprobar transporte'}
            </button>
          </div>
        </Modal>
      )}
      
      {showReject && (
        <Modal title="Rechazar transporte" onClose={() => setShowReject(false)}>
          <label className="pay-label" htmlFor="transport-reason">Motivo (lo verá el cliente)</label>
          <textarea
            id="transport-reason" className="pay-textarea" rows={3} value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder="Ej: la licencia está vencida"
          />
          <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 12 }}>
            <input type="checkbox" checked={blacklist} onChange={(e) => setBlacklist(e.target.checked)} />
            Vetar al transportador: no podrá volver a ingresar a la planta
          </label>
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setShowReject(false)} disabled={busy}>Cancelar</button>
            <button
              type="button" 
              className="pay-btn is-danger" 
              disabled={!reason.trim() || isBusy}
              onClick={handleReject}
            >
              {busy === 'reject' ? 'Rechazando...' : 'Rechazar'}
            </button>
          </div>
        </Modal>
      )}
      
      {docToReject && (
        <Modal title={`Rechazar: ${docToReject.label}`} onClose={() => setDocToReject(null)}>
          <label className="pay-label" htmlFor="doc-reason">Motivo (lo verá el cliente)</label>
          <textarea
            id="doc-reason" className="pay-textarea" rows={3} value={docReason}
            onChange={(e) => setDocReason(e.target.value)} placeholder="Ej: la imagen no se lee"
          />
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setDocToReject(null)} disabled={isBusy}>Cancelar</button>
            <button
              type="button" className="pay-btn is-danger" disabled={!docReason.trim() || isBusy}
              onClick={() => handleReviewDoc(docToReject.doc, 'rejected', docReason.trim())}
            >
              {busy === 'review' ? 'Rechazando...' : 'Rechazar documento'}
            </button>
          </div>
        </Modal>
      )}
      
      {preview && <FilePreviewModal {...preview} onClose={() => setPreview(null)} />}
    </>
  )
}