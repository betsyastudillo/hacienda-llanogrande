import { useState } from 'react'
import { CircleCheck, CircleX, Clock, Eye, Upload } from 'lucide-react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import Modal from '../../../components/Modal/Modal'
import StatusBadge from '../../../components/StatusBadge/StatusBadge'
import FilePreviewModal from '../../../components/FilePreviewModal/FilePreviewModal'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { 
    TRANSPORT_DOCS, CARRIER_DOCUMENT_TYPES, OWNER_DOCUMENT_TYPES, VEHICLE_TYPES, vehicleTypeLabel, 
} from '../../../constants/transport'


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

export default function TransportCard({ order, assignment, dispatchGuide, onChanged }) {
  const { hasPermission } = useAuth()
  const { showToast } = useToast()

  const canSubmit = hasPermission('assignment:crear_propio')
  const canValidate = hasPermission('assignment:validar')
  const canGuide = hasPermission('dispatch_guide:crear')

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

  const isBusy = busy !== null

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })
  const setDigits = (f) => (e) => setForm({ ...form, [f]: e.target.value.replace(/\D/g, '') })


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
      console.log(assignment)
      const v = assignment.vehicle
      const c = assignment.carrier

      setOwnerIsCarrier(sameOwner)

      setForm({
        plate: v.plate,
        type: v.type,
        capacity_m3: String(v.capacity_m3),
        owner_name: v.owner_name || '',
        owner_document_type: v.owner_document_type,
        owner_document_id: v.owner_document_id || '',
        owner_phone: v.owner_phone,
        full_name: c.full_name,
        document_type: c.document_type,
        document_id: c.document_id,
        phone: c.phone || '',
        address: c.address || ''
      })
    } else {
      setOwnerIsCarrier(false)
      setForm(EMPTY_FORM)
      setBlocked({ vehicle: null, carrier: false })
    }

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
    if (assignment && plate === assignment.vehicle.plate) return

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
    if (assignment && id === assignment.carrier.document_id && form.document_type === assignment.carrier.document_type) return

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
    run('approve',
      () => api.patch(`/assignments/${assignment.id}/validate`, {
        decision: 'approved',
        rejection_reason: null,
        background_check_verified: true,
        blacklist_carrier: false,
      }),
      'Transporte aprobado.',
      'No se pudo aprobar el transporte',
      () => setShowApprove(false)
    )
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
    return { key, label, doc, isMissing: missing.includes(key) }
  })

  const canFix = canSubmit && assignment?.validation_status === 'rejected'
  const canUpload = canSubmit && assignment && assignment?.validation_status !== 'approved'
  const canDecide = canValidate && assignment?.validation_status === 'pending'
  const canMakeGuide =
    canGuide && assignment?.validation_status === 'approved' &&
    order.status === 'transport_validated' && !dispatchGuide

console.log({
  busy,
  tipoBusy: typeof busy,
  isBusy,
  faltan: missing.length,
  vetados: assignment?.blocked?.length,
  docsPending: typeof docsPending === 'undefined' ? 'no existe' : docsPending,
  missing
})

  return (
    <div className="detail-card">
      <p className="detail-card-title">Transporte</p>

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
            <p className="pay-error">
              {canValidate
                ? 'Atención: el vehículo, su dueño o el transportador están en la lista de vetados. No se puede aprobar este transporte.'
                : 'Este transporte no está autorizado. Si tienes dudas, comunícate con Logística.'}
            </p>
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

          <p className="detail-card-title" style={{ marginTop: 14 }}>Documentos</p>
          <div className="detail-info-list">

            {docRows.map(({ key, label, doc, isMissing }) => (
              <div key={key} className="detail-info-row">
                <span>{label}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

                  {isMissing ? <em>Falta</em> : <CircleCheck size={14} />}
                  {doc && (
                    <button
                      type="button" 
                      className="pay-link" 
                      title="Ver documento"
                      onClick={() => openPreview(label, doc)}
                    >
                      <Eye size={14} />
                    </button>
                  )}

                  {canUpload && (
                    <label className="pay-link" title={doc ? 'Reemplazar' : 'Subir'}>
                      <Upload size={14} />
                      <input
                        type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => { handleUpload(key, e.target.files[0]); e.target.value = '' }}
                      />
                    </label>
                  )}

                </span>
              </div>
            ))}
          </div>

          {busy === 'upload' && <p className="detail-empty-inline pay-hint">Subiendo documento...</p>}

          {canUpload && missing.length > 0 && (
            <p className="detail-empty-inline pay-hint">
              Sube los documentos que faltan (PDF o imagen, máximo 5 MB).
            </p>
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
                disabled={busy}
              >
                Rechazar
              </button>

              <button
                className="pay-btn is-primary"
                onClick={() => { setChecked(false); setShowApprove(true) }}
                disabled={isBusy || missing.length > 0 || assignment.blocked?.length > 0}
                title={missing.length > 0 ? 'Faltan documentos' : undefined}
              >
                Aprobar
              </button>
            </div>
          )}

          {canMakeGuide && (
            <div className="pay-actions">
              <button
                type='button'
                className="pay-btn is-primary" 
                disabled={busy}
                onClick={handleCreateGuide}
              >
                Generar guía de despacho
              </button>
            </div>
          )}
        </>
      )}

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
                      onChange={(e) => {
                        set('owner_document_type')(e)
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
              {blocked.carrier && (
                <p className="pay-error">
                  Este transportador no está autorizado para realizar el transporte. Si tienes dudas, comunícate con Logística.
                </p>
              )}
            </div>

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
              disabled={busy}
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
        <Modal title="Aprobar transporte" onClose={() => setShowApprove(false)}>
          <label style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            Confirmo que consulté los antecedentes del transportador y que los datos del dueño y los
            documentos coinciden con la tarjeta de propiedad.
          </label>
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setShowApprove(false)} disabled={busy}>Cancelar</button>
            <button
              type="button"
              className="pay-btn is-primary"
              disabled={!checked || isBusy}
              onClick={handleApprove}
            >
              {busy === 'approve' ? 'Aprobando...' : 'Aprobar'}
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
              disabled={!reason.trim() || busy}
              onClick={handleReject}
            >
              {busy === 'reject' ? 'Rechazando...' : 'Rechazar'}
            </button>
          </div>
        </Modal>
      )}

      {preview && <FilePreviewModal {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}