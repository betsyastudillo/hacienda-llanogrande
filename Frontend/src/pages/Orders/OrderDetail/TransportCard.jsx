import { useState } from 'react'
import { CircleCheck, CircleX, Clock, Eye, Upload } from 'lucide-react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import Modal from '../../../components/Modal/Modal'
import StatusBadge from '../../../components/StatusBadge/StatusBadge'
import FilePreviewModal from '../../../components/FilePreviewModal/FilePreviewModal'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { TRANSPORT_DOCS, CARRIER_DOCUMENT_TYPES } from '../../../constants/transport'

// ---- Llamadas al backend: ajustar aquí si algo no coincide ----
const api_ = {
  create: (body) => api.post('/assignments/', body),
  // VERIFICAR: el cuerpo del reenvío (se asume igual al de crear, sin order_id)
  resubmit: (orderId, body) => api.put(`/assignments/order/${orderId}/resubmit`, body),
  uploadDoc: (orderId, subject, documentType, file) => {
    const fd = new FormData()
    fd.append('subject', subject)
    fd.append('document_type', documentType)
    fd.append('file', file)
    return api.post(`/assignments/order/${orderId}/documents`, fd)
  },
  // VERIFICAR: nombres de los campos del cuerpo
  validate: (id, body) => api.patch(`/assignments/${id}/validate`, body),
  // VERIFICAR: cuerpo del POST
  createGuide: (orderId) => api.post('/dispatch-guides/', { order_id: orderId }),
}

// VERIFICAR: ruta de descarga de un documento de transporte
const docPreviewPath = (orderId, doc) => `/assignments/order/${orderId}/documents/${doc.id}`

const STATUS = {
  pending: { label: 'Pendiente de validación', icon: Clock, bg: '#fdf1b8', text: '#7a5c00' },
  approved: { label: 'Aprobado', icon: CircleCheck, bg: '#d9efdc', text: '#1f6b34' },
  rejected: { label: 'Rechazado', icon: CircleX, bg: '#fbdcdc', text: '#a12a2a' },
}

const EMPTY_FORM = {
  plate: '', capacity_m3: '',
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
  const [showApprove, setShowApprove] = useState(false)
  const [checked, setChecked] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  const fail = (err, fallback) => showToast(getErrorMessage(err, fallback), 'error')
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value })

  // Ejecuta una acción mostrando el resultado como toast y recargando el pedido
  async function run(action, okMessage, errorMessage, after) {
    setBusy(true)
    try {
      await action()
      showToast(okMessage)
      after?.()
      await onChanged()
    } catch (err) {
      fail(err, errorMessage)
    } finally {
      setBusy(false)
    }
  }

  function openForm() {
    // Al corregir un rechazo se precargan los datos actuales
    setForm(
      assignment
        ? {
            plate: assignment.vehicle.plate,
            capacity_m3: String(assignment.vehicle.capacity_m3),
            full_name: assignment.carrier.full_name,
            document_type: assignment.carrier.document_type,
            document_id: assignment.carrier.document_id,
            phone: assignment.carrier.phone || '',
            address: assignment.carrier.address || '',
          }
        : EMPTY_FORM
    )
    setShowForm(true)
  }

  function handleSubmit() {
    if (!form.plate.trim() || !(Number(form.capacity_m3) > 0) || !form.full_name.trim() || !form.document_id.trim())
      return showToast('Completa la placa, la capacidad y los datos del transportador.', 'error')

    // VERIFICAR: nombres y estructura (vehicle / carrier) según schemas/assignment.py
    const body = {
      vehicle: { plate: form.plate.trim(), capacity_m3: Number(form.capacity_m3) },
      carrier: {
        full_name: form.full_name.trim(),
        document_type: form.document_type,
        document_id: form.document_id.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      },
    }

    run(
      () => (assignment ? api_.resubmit(order.id, body) : api_.create({ order_id: order.id, ...body })),
      assignment ? 'Datos corregidos y reenviados a logística.' : 'Datos de transporte enviados. Ahora sube los documentos.',
      'No se pudo enviar el transporte',
      () => setShowForm(false)
    )
  }

  function handleUpload(key, file) {
    if (!file) return
    const [subject, documentType] = key.split(':')
    run(() => api_.uploadDoc(order.id, subject, documentType, file), 'Documento subido.', 'No se pudo subir el documento')
  }

  const missing = assignment?.missing_documents || []
  const status = assignment ? STATUS[assignment.validation_status] || STATUS.pending : null

  // Un documento subido o faltante, por cada uno de los 4 requeridos
  const docRows = Object.entries(TRANSPORT_DOCS).map(([key, label]) => {
    const [subject, documentType] = key.split(':')
    const doc = assignment?.documents?.find(
      (d) => d.document_type === documentType && (subject === 'vehicle' ? d.vehicle_id : d.carrier_id)
    )
    return { key, label, doc, isMissing: missing.includes(key) }
  })

  const canFix = canSubmit && assignment && assignment.validation_status === 'rejected'
  const canUpload = canSubmit && assignment && assignment.validation_status !== 'approved'
  const canDecide = canValidate && assignment?.validation_status === 'pending'
  const canMakeGuide =
    canGuide && assignment?.validation_status === 'approved' &&
    order.status === 'transport_validated' && !dispatchGuide

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
          <div className="detail-info-list">
            <div className="detail-info-row">
              <span>Estado</span>
              <StatusBadge label={status.label} bgColor={status.bg} textColor={status.text} icon={status.icon} />
            </div>
            <div className="detail-info-row"><span>Placa</span><span>{assignment.vehicle.plate}</span></div>
            <div className="detail-info-row"><span>Capacidad</span><span>{assignment.vehicle.capacity_m3} </span></div>
            <div className="detail-info-row">
              <span>Transportador</span><span>{assignment.carrier.full_name}</span>
            </div>
            <div className="detail-info-row">
              <span>Documento</span>
              <span>{assignment.carrier.document_type} {assignment.carrier.document_id}</span>
            </div>
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
                      type="button" className="pay-link" title="Ver documento"
                      onClick={() => setPreview({ title: label, apiPath: docPreviewPath(order.id, doc) })}
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

          {canUpload && missing.length > 0 && (
            <p className="detail-empty-inline pay-hint">
              Sube los documentos que faltan (PDF o imagen, máximo 5 MB).
            </p>
          )}
          {assignment.validation_status === 'pending' && !canValidate && missing.length === 0 && (
            <p className="detail-empty-inline pay-hint">En revisión por logística.</p>
          )}

          <div className="pay-actions">
            {canFix && <button className="pay-btn is-primary" onClick={openForm}>Corregir datos</button>}
          </div>

          {canDecide && (
            <div className="pay-decision">
              <button className="pay-btn is-danger" onClick={() => { setReason(''); setShowReject(true) }} disabled={busy}>
                Rechazar
              </button>
              <button
                className="pay-btn is-primary"
                onClick={() => { setChecked(false); setShowApprove(true) }}
                disabled={busy || missing.length > 0}
                title={missing.length > 0 ? 'Faltan documentos' : undefined}
              >
                Aprobar
              </button>
            </div>
          )}

          {canMakeGuide && (
            <div className="pay-actions">
              <button
                className="pay-btn is-primary" disabled={busy}
                onClick={() => run(() => api_.createGuide(order.id), 'Guía de despacho generada.', 'No se pudo generar la guía')}
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
                <input value={form.plate} onChange={set('plate')} maxLength={7} />
              </label>
              <label className="edit-field">Capacidad
                <input type="number" min="0" value={form.capacity_m3} onChange={set('capacity_m3')} />
              </label>
            </div>

            <p className="edit-section">Transportador</p>
            <label className="edit-field">Nombre completo
              <input value={form.full_name} onChange={set('full_name')} />
            </label>
            <div className="edit-row">
              <label className="edit-field">Tipo de documento
                <select value={form.document_type} onChange={set('document_type')}>
                  {CARRIER_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="edit-field">Número
                <input value={form.document_id} onChange={set('document_id')} />
              </label>
            </div>
            <div className="edit-row">
              <label className="edit-field">Teléfono
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
              </label>
              <label className="edit-field">Dirección
                <input value={form.address} onChange={set('address')} />
              </label>
            </div>
          </div>
          <div className="company-detail-approve-actions edit-actions">
            <button type="button" className="company-detail-cancel-reject-btn" onClick={() => setShowForm(false)} disabled={busy}>Cancelar</button>
            <button type="button" className="company-detail-approve-btn" onClick={handleSubmit} disabled={busy}>
              {busy ? 'Enviando...' : assignment ? 'Reenviar' : 'Enviar'}
            </button>
          </div>
        </Modal>
      )}

      {showApprove && (
        <Modal title="Aprobar transporte" onClose={() => setShowApprove(false)}>
          <label style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            Confirmo que consulté los antecedentes del transportador y revisé los documentos.
          </label>
          <div className="company-detail-approve-actions edit-actions">
            <button type="button" className="company-detail-cancel-reject-btn" onClick={() => setShowApprove(false)} disabled={busy}>Cancelar</button>
            <button
              type="button" className="company-detail-approve-btn" disabled={!checked || busy}
              onClick={() => run(
                // VERIFICAR: nombres de los campos del cuerpo
                () => api_.validate(assignment.id, { validation_status: 'approved', background_check_verified: true }),
                'Transporte aprobado.', 'No se pudo aprobar el transporte', () => setShowApprove(false)
              )}
            >
              {busy ? 'Aprobando...' : 'Aprobar'}
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
          <div className="company-detail-approve-actions edit-actions">
            <button type="button" className="company-detail-cancel-reject-btn" onClick={() => setShowReject(false)} disabled={busy}>Cancelar</button>
            <button
              type="button" className="company-detail-reject-confirm-btn" disabled={!reason.trim() || busy}
              onClick={() => run(
                () => api_.validate(assignment.id, { validation_status: 'rejected', rejection_reason: reason.trim() }),
                'Transporte rechazado.', 'No se pudo rechazar el transporte', () => setShowReject(false)
              )}
            >
              {busy ? 'Rechazando...' : 'Rechazar'}
            </button>
          </div>
        </Modal>
      )}

      {preview && <FilePreviewModal {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}