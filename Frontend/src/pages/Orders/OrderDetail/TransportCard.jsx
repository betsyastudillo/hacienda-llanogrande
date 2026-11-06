import { useState, useEffect } from 'react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import { useVehicleTypes } from '../../../hooks/useVehicleTypes'
import Modal from '../../../components/Modal/Modal'
import StatusBadge from '../../../components/StatusBadge/StatusBadge'
import FilePreviewModal from '../../../components/FilePreviewModal/FilePreviewModal'
import CollapsibleCard from '../../../components/CollapsibleCard/CollapsibleCard'
import ComplianceTable from '../../../components/ComplianceTable/ComplianceTable'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { formatDate, formatDateTime, todayISO } from '../../../utils/formatDate'
import { formatQuantity } from '../../../utils/formatQuantity.js'
import { suggestPickup } from '../../../utils/pickupSuggestion.js'
import { isValidAddress, MIN_ADDRESS_LENGTH } from '../../../utils/validators'
import { formatCapacity } from '../../../utils/formatNumber'
import { capacityStatus } from '../../../utils/vehicleCapacity.js'
import { TRANSPORT_STATUS_LABELS, TRANSPORT_STATUS_COLORS, TRANSPORT_STATUS_ICONS, } from '../../../constants/transportStatus'
import { estimateWeightKg } from '../../../constants/units.js'
import { 
    TRANSPORT_DOCS, CARRIER_DOCUMENT_TYPES, OWNER_DOCUMENT_TYPES,  TRANSPORT_CHECK_LABELS, TRANSPORT_CHECK_SUBJECTS, BLOCKING_TRANSPORT_CHECKS, OTHER_REASON, rejectionReasonsFor, EXPIRING_TRANSPORT_DOCS
} from '../../../constants/transport'
import TransportDocuments from './TransportDocuments'


const API_BASE = api.defaults.baseURL
const WITHDRAWAL_STATUSES = ['facturado', 'partially_dispatched']
const EMPTY_FORM = {
  plate: '', type: '',
  owner_name: '', owner_document_type: 'CC', owner_document_id: '', owner_phone: '',
  full_name: '', document_type: 'CC', document_id: '', phone: '', address: ''
}

const SUBJECT_ORDER = ['vehicle', 'owner', 'carrier']


export default function TransportCard({ order, assignment, products, onChanged, defaultOpen }) {
  
  const { hasPermission } = useAuth()
  const { showToast } = useToast()
  
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [ownerIsCarrier, setOwnerIsCarrier] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [blacklist, setBlacklist] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(null)

  const [hint, setHint] = useState({ vehicle: false, carrier: false, owner: false })
  const [blocked, setBlocked] = useState({ vehicle: null, carrier: false, owner: false })
  const [blockReason, setBlockReason] = useState('')
  const [blockBlacklist, setBlockBlacklist] = useState(false)
  const [blacklistVehicle, setBlacklistVehicle] = useState(false)
  const [blacklistOwner, setBlacklistOwner] = useState(false)

  const [docToReject, setDocToReject] = useState(null)   // { doc, label }
  const [docReason, setDocReason] = useState('')
  const [docReasonChoice, setDocReasonChoice] = useState('')   // para rechazo de documentos
  const [checkValues, setCheckValues] = useState({})   // { 'vehicle:simit': { has_findings, note } }
  const [pendingUpload, setPendingUpload] = useState(null)   // { key, file, label }
  const [expiryDate, setExpiryDate] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [postReview, setPostReview] = useState(false)
  const [qty, setQty] = useState({})   // { [order_item_id]: '30' }
  const [qtyTouched, setQtyTouched] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const isBusy = busy !== null
  
  const set = (f) => (e) => { setForm({ ...form, [f]: e.target.value }); setFormError('') }
  const setDigits = (f) => (e) => { setForm({ ...form, [f]: e.target.value.replace(/\D/g, '') }); setFormError('') }
  
  const guide = assignment?.dispatch_guide || null
  const isCancelled = Boolean(assignment?.cancelled_at)
  const inWithdrawalPhase = WITHDRAWAL_STATUSES.includes(order.status)
  // Un retiro se puede tocar mientras no esté anulado y su guía no se haya usado
  const isOpen = Boolean(assignment) && !isCancelled && inWithdrawalPhase && guide?.status !== 'used'

  const canValidate = hasPermission('assignment:validar')
  const canGuide = hasPermission('dispatch_guide:crear')
  const canSubmit = hasPermission('assignment:crear_propio') && !canValidate
  const canFix = canSubmit && isOpen && ['pending', 'rejected'].includes(assignment?.validation_status)
  const canDecide = canValidate && isOpen && assignment?.validation_status === 'pending'
  const canMakeGuide = canGuide && isOpen && assignment?.validation_status === 'approved' && !guide
  const canUpload = canSubmit && isOpen && assignment?.validation_status !== 'approved'
  const canCorrect = hasPermission('assignment:corregir') && isOpen
  const canCancel = canCorrect && guide?.status !== 'in_plant'

  const statusKey = assignment && TRANSPORT_STATUS_LABELS[assignment.validation_status]
    ? assignment.validation_status
    : 'pending'

  const status = assignment ? {
    label: TRANSPORT_STATUS_LABELS[statusKey],
    icon: TRANSPORT_STATUS_ICONS[statusKey],
    bg: TRANSPORT_STATUS_COLORS[statusKey].bgColor,
    text: TRANSPORT_STATUS_COLORS[statusKey].textColor,
  } : null

  const summary = !assignment ? 'Sin programar'
    : isCancelled ? 'Anulado'
    : guide?.status === 'used' ? 'Despachado'
    : guide?.status === 'in_plant' ? 'En planta'
    : guide ? 'Guía generada'
    : status.label

  const { types: vehicleTypes, labelOf: vehicleTypeLabel } = useVehicleTypes()

  const productOf = (orderItemId) => {
    const item = order.items.find((i) => i.id === orderItemId)
    const product = products.find((p) => p.id === item?.product_id)
    const parent = product?.parent_product_id ? products.find((p) => p.id === product.parent_product_id) : null
    return { item, product, parent }
  }

  // Lo que todavía se puede programar de cada producto (para un retiro nuevo)
  const pendingLines = order.items
    .map((item) => {
      const { product, parent } = productOf(item.id)
      const unitKg = product ? estimateWeightKg(product.approx_weight_kg, product.unit, 1) : null
      return { item, product, parent, pending: item.pending_quantity || 0, unitKg }
    })
    .filter((l) => l.pending > 0)

  const suggestionFor = (typeCode) => {
    const type = vehicleTypes.find((t) => t.code === typeCode)
    if (!type?.capacity_kg) return null

    return suggestPickup(
      pendingLines.map((l) => ({ id: l.item.id, pending: l.pending, unitKg: l.unitKg })),
      Number(type.capacity_kg)
    )
  }

  // Sin vehículo, o sin pesos conocidos, se deja todo lo pendiente
  function applySuggestion(typeCode) {
    const result = suggestionFor(typeCode)
    const source = result ? result.quantities : Object.fromEntries(pendingLines.map((l) => [l.item.id, l.pending]))

    setQty(Object.fromEntries(Object.entries(source).map(([id, q]) => [id, String(q)])))
    setQtyTouched(false)
  }

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

  const buildChecksPayload = () =>
    Object.entries(checkValues)
      .filter(([, val]) => typeof val.has_findings === 'boolean')
      .map(([full, val]) => {
        const [subject, check_key] = full.split(':')
        
        return { 
          subject, 
          check_key,
          subject_ref: currentRef[subject], 
          has_findings: val.has_findings, 
          note: val.note?.trim() || null 
        }
      })

  function openForm() {
    setFormError('')
    setChangeReason('')

    if (assignment) {
      const v = assignment.vehicle
      const c = assignment.carrier

      setOwnerIsCarrier(sameOwner)

      setForm({
        plate: v.plate,
        type: v.type,
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
      applySuggestion('') 
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

    const isCorrection = canCorrect // logistica o admin corrigiendo

    if (!owner.name.trim() || !owner.id.trim())
      return setFormError('Completa los datos del dueño del vehículo.')

    if (!form.full_name.trim() || !form.document_id.trim() || !form.address.trim())
      return setFormError('Completa el nombre, el documento y la dirección del transportador.')

    if (!/^\d{7,15}$/.test(form.phone))
      return setFormError('El teléfono del transportador debe tener entre 7 y 15 dígitos.')

    if (!isValidAddress(form.address))
      return setFormError(`La dirección del transportador debe tener al menos ${MIN_ADDRESS_LENGTH} caracteres.`)

    if (needsChangeReason && !changeReason.trim()) return setFormError('Indica el motivo del cambio.')
    
    let items = []

    if (!assignment) {
      for (const l of pendingLines) {
        const q = Number(qty[l.item.id] || 0)

        if (!Number.isInteger(q) || q < 0 || q > l.pending)
          return setFormError(`La cantidad de ${l.product?.name || 'un producto'} debe ser un entero entre 0 y ${l.pending}.`)

        if (q > 0) items.push({ order_item_id: l.item.id, quantity: q })
      }

      if (items.length === 0) return setFormError('Indica al menos una cantidad para este retiro.')
    }

    setFormError('')
    
    const body = {
      vehicle: {
        plate: form.plate.trim(),
        type: form.type,
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
    
    if (needsChangeReason) body.reason = changeReason.trim()

    run( 'submit',
      () => {
        if (isCorrection) return api.put(`/assignments/${assignment.id}/correct`, body)
        if (assignment) return api.put(`/assignments/${assignment.id}/resubmit`, body)
        return api.post('/assignments/', { order_id: order.id, items, ...body })
      },
      isCorrection
      ? 'Datos corregidos'
      : assignment
        ? 'Datos corregidos y reenviados a logística.'
        : 'Datos enviados. Ahora sube los documentos.',
      'No se pudo enviar el transporte',
      () => setShowForm(false),
      setFormError
    )
  }

  function handleUpload(key, file, expiresAt = null) {

    if (!file) return

    // Los documentos que vencen piden la fecha antes de subirse
    if (EXPIRING_TRANSPORT_DOCS.includes(key) && !expiresAt) {
      setExpiryDate('')
      setUploadError('')
      setPendingUpload({ key, file, label: TRANSPORT_DOCS[key] })
      return
    }

    const [subject, documentType] = key.split(':')

    const formData = new FormData()
    formData.append('subject', subject)
    formData.append('document_type', documentType)
    formData.append('file', file)
    if (expiresAt) formData.append('expires_at', expiresAt)
    
    run('upload',
      () => api.post(`/assignments/${assignment.id}/documents`, formData),
      'Documento subido.',
      'No se pudo subir el documento',
      () => { setPendingUpload(null); setExpiryDate(''); setUploadError('') },    
      pendingUpload ? setUploadError : undefined       
    )
  }

  function handleApprove() {
    run('approved',
      () => api.patch(`/assignments/${assignment.id}/validate`, {
        decision: 'approved',
        rejection_reason: null,
        background_check_verified: true,
        blacklist_carrier: false,
        checks: buildChecksPayload(),
      }),
      'Transporte aprobado.',
      'No se pudo aprobar el transporte',
      () => closeApprove()
    )
  }

  function handleApproveAll() {
    const pending = docRows.filter((r) => r.status === 'pending').map((r) => r.doc)

    run(
      'review-all',
      async () => {
        try {
          for (const doc of pending) {
            await api.patch(`/assignments/${assignment.id}/documents/${doc.id}/review`, { status: 'approved', reason: null })
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
      () => api.patch(`/assignments/${assignment.id}/documents/${doc.id}/review`, { status, reason }),
      status === 'approved' ? 'Documento aprobado.' : 'Documento rechazado.',
      'No se pudo revisar el documento',
      () => setDocToReject(null)
    )
  }

  function openRejectDoc(doc, label) {
    setDocReasonChoice('')
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
        blacklist_vehicle: blacklistVehicle,
        blacklist_owner: blacklistOwner,
      }),
      'Transporte rechazado.',
      'No se pudo rechazar el transporte',
      () => setShowReject(false)
    )
  }

  function handleRejectForFinding() {
    run('reject-finding',
      () => api.patch(`/assignments/${assignment.id}/validate`, {
        decision: 'rejected',
        rejection_reason: blockReason.trim(),
        background_check_verified: false,
        blacklist_carrier: blockBlacklist,
        blacklist_vehicle: blacklistVehicle,
        blacklist_owner: blacklistOwner,
        checks: buildChecksPayload(),
      }),
      'Transporte rechazado. La consulta quedó registrada.',
      'No se pudo rechazar el transporte',
      () => closeApprove()
    )
  }

  function handleCreateGuide() {
    run('guide',
      () => api.post('/dispatch-guides/', { assignment_id: assignment.id }),
      'Guía de despacho generada.',
      'No se pudo generar la guía'
    )
  }

  function handleCompleteReview() {
    run('complete-review',
      () => api.post(`/assignments/${assignment.id}/complete-review`, {
        checks: buildChecksPayload(),
        blacklist_carrier: blockBlacklist,
        blacklist_vehicle: blacklistVehicle,
        blacklist_owner: blacklistOwner,
        reason: blockReason.trim() || null,
      }),
      'Consultas registradas.',
      'No se pudieron registrar las consultas',
      closeApprove
    )
  }

  function handleCancel() {
    run('cancel',
      () => api.post(`/assignments/${assignment.id}/cancel`, { reason: cancelReason.trim() }),
      'Retiro anulado.',
      'No se pudo anular el retiro',
      () => setShowCancel(false)
    )
  }

  function openPreview(label, doc) {
    setPreview({
      title: label,
      apiPath: `/assignments/${assignment.id}/documents/${doc.id}/file`,
    })
  }

  function closeApprove() {
    setShowApprove(false)
    setPostReview(false)
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
    return { key, label, doc, status: doc ? (doc.is_expired ? 'expired' : doc.status) : 'missing' }
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

  // Referencia vigente de cada sujeto, con el mismo formato que guarda el backend
  const currentRef = {
    vehicle: v?.plate,
    owner: v ? `${v.owner_document_type} ${v.owner_document_id}` : null,
    carrier: c ? `${c.document_type} ${c.document_id}` : null,
  }

  const allFindings = (assignment?.checks || []).filter(
    (ch) => ch.has_findings && (canValidate || !BLOCKING_TRANSPORT_CHECKS.includes(ch.check_key))
  )

  const hasFindings = Object.values(checkValues).some((val) => val.has_findings)

  const blockingHit = Object.entries(checkValues).some(
    ([full, val]) => val.has_findings && BLOCKING_TRANSPORT_CHECKS.includes(full.split(':')[1])
  )
  const findingsHaveNotes = Object.values(checkValues).every((val) => !val.has_findings || val.note?.trim())

  // El cliente no ve los hallazgos bloqueantes. Estos son los hallazgos presentes de quien figura
  const findings = allFindings.filter((ch) => ch.subject_ref === currentRef[ch.subject])  

  // Hallazgos de la persona anterior (si cambian de sujeto, avisa por qué se había rechazado el anterior)
  const pastFindings = allFindings.filter((ch) => ch.subject_ref !== currentRef[ch.subject]) 

  // Solo para quien revisa: por si el cliente corrigió los datos mientras el transporte estaba pendiente
  const correctedByClient = canValidate && assignment?.validation_status === 'pending' && Boolean(assignment?.updated_at)

  // El dueño solo cuenta si su sección está visible; si es el transportador, ya lo cubre el aviso del transportador
  const formBlocked = Boolean(blocked.vehicle) || blocked.carrier || (!ownerIsCarrier && blocked.owner)
  
  // Si se puede corregir, y el transporte ya estaba aprobado, hay que indicar un motivo de cambio
  const needsChangeReason = canCorrect && assignment?.validation_status === 'approved'

  // Falta algún documento o alguno no está aprobado todavía
  const docsUnapproved = docRows.some((r) => r.status !== 'approved')

  // Aviso para vetar el vehiculo
  const vehicleBanBox = (
    <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 8 }}>
      <input type="checkbox" checked={blacklistVehicle} onChange={(e) => setBlacklistVehicle(e.target.checked)} />
      Vetar el vehículo ({v?.plate}): solo si el vehículo es el problema (robo, placa clonada, documentos falsos)
    </label>
  )

  // Aviso para vetar al propietario del vehículo
  const ownerBanBox = !sameOwner && (
    <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 8 }}>
      <input type="checkbox" checked={blacklistOwner} onChange={(e) => setBlacklistOwner(e.target.checked)} />
      Vetar al propietario ({v?.owner_name}): si la persona está en listas vinculantes
    </label>
  )

  // Razones para el rechazo de documentos
  const docReasonOptions = docToReject ? rejectionReasonsFor(docToReject.doc.document_type) : []

  // El motivo final: el de la lista, o lo que escribió quien revisa si eligió "Otro motivo"
  const finalDocReason = docReasonChoice === OTHER_REASON ? docReason.trim() : docReasonChoice

  const selectedType = vehicleTypes.find((t) => t.code === form.type)

  // Peso de lo que se lleva ESTE retiro: lo escrito en el formulario (nuevo) o lo ya registrado
  const withdrawalWeightKg = assignment
    ? assignment.items.reduce((sum, ai) => {
        const { product } = productOf(ai.order_item_id)
        return sum + (product ? estimateWeightKg(product.approx_weight_kg, product.unit, ai.quantity) || 0 : 0)
      }, 0)
    : pendingLines.reduce((sum, l) => sum + (Number(qty[l.item.id]) || 0) * (l.unitKg || 0), 0)

  const fit = capacityStatus(selectedType?.capacity_kg, withdrawalWeightKg)
  const suggestion = !assignment ? suggestionFor(form.type) : null

  return (
    <>
      <CollapsibleCard
        title={assignment ? `Retiro ${assignment.sequence}` : 'Nuevo retiro'}
        summary={summary}
        defaultOpen={defaultOpen}
      >
        {!assignment ? (
          <>
            <p className="detail-empty-inline">
              {!inWithdrawalPhase
                ? 'Los retiros se programan una vez el pedido esté facturado.'
                : canSubmit
                  ? 'Programa un retiro: indica qué cantidad se lleva y quién la recoge.'
                  : 'Aún no se ha programado ningún retiro.'}
            </p>
            {inWithdrawalPhase && canSubmit && (
              <div className="pay-actions">
                <button className="pay-btn is-primary" onClick={openForm}>Programar retiro</button>
              </div>
            )}
          </>
        ) : (
          <>
            {isCancelled && (
              <p className="detail-empty-inline pay-hint">
                Retiro anulado el {formatDate(assignment.cancelled_at)}. Motivo: {assignment.cancellation_reason}
              </p>
            )}
    
            {assignment.blocked?.length > 0 && assignment.validation_status !== 'approved' && (
              <p className="detail-error-text">
                {canValidate
                  ? `Atención: ${blockedWhat} figura en la lista de vetados. No se puede aprobar este transporte.`
                  : `No está autorizado: ${blockedWhat}. Corrige los datos y reenvía, o comunícate con el área de Logística.`}
              </p>
            )}

            {assignment.review_pending && canValidate && (
              <p className="pay-error">
                Se cambió el transportador o el vehículo. Faltan las consultas en listas y los documentos nuevos.
              </p>
            )}

            {assignment.review_pending && canValidate && (
              <div className="pay-actions">
                <button
                  type="button"
                  className="pay-btn is-primary"
                  onClick={() => {
                    setCheckValues({})
                    setBlockReason('')
                    setBlockBlacklist(false)
                    setBlacklistVehicle(false)
                    setBlacklistOwner(false)
                    setPostReview(true)
                    setShowApprove(true)
                  }}
                >
                  Registrar consultas
                </button>
              </div>
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

            {canValidate && pastFindings.length > 0 && (
              <p className="detail-empty-inline pay-hint">
                Hubo hallazgos en una versión anterior de este envío, sobre {pastFindings.map((ch) => ch.subject_ref).join(', ')}.
                Los datos actuales son distintos.
              </p>
            )}

            {correctedByClient && (
              <p className="detail-empty-inline pay-hint">
                Se corrigieron los datos el {formatDate(assignment.updated_at)}. Revisa que las consultas y los
                documentos correspondan a la información de hoy.
              </p>
            )}

            <div className="detail-info-list">
              <div className="detail-info-row">
                <span>Estado</span>
                <StatusBadge label={status.label} bgColor={status.bg} textColor={status.text} icon={status.icon} />
              </div>
              {assignment.items.map((ai) => {
                const { product, parent } = productOf(ai.order_item_id)
                return (
                  <div className="detail-info-row" key={ai.id}>
                    <span>{product?.name || 'Producto'}</span>
                    <span>{product ? formatQuantity(ai.quantity, product, parent) : ai.quantity}</span>
                  </div>
                )
              })}
              <div className="detail-info-row">
                <span>Placa</span>
                <span>{assignment.vehicle.plate}</span>
              </div>
              <div className="detail-info-row">
                <span>Tipo</span>
                <span>{vehicleTypeLabel(assignment.vehicle.type)}</span>
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
              canReview={canDecide}
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

            {canUpload && docRows.some((r) => r.status === 'expired') && (
              <p className="detail-empty-inline pay-hint">Hay documentos vencidos: sube la versión vigente.</p>
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
              <p className="detail-empty-inline pay-hint">En revisión por el área de logística.</p>
            )}

            {(canFix || canCorrect) && (
              <div className="pay-actions">
                {/* {canCancel && (
                  <button className="pay-btn is-danger" disabled={isBusy} onClick={() => { setCancelReason(''); setShowCancel(true) }}>
                    Anular retiro
                  </button>
                )} */}
                <button className="pay-btn is-primary" onClick={openForm}>Corregir datos</button>
              </div>
            )}
  
            {canDecide && (
              <div className="pay-decision">
                <button 
                  className="pay-btn is-danger" 
                  onClick={() => { 
                    setReason(''); setBlacklist(false); 
                    setBlacklistVehicle(false); setBlacklistOwner(false)
                    setShowReject(true) }}
                  disabled={isBusy}
                >
                  Rechazar
                </button>
  
                <button
                  className="pay-btn is-primary"
                  onClick={() => { 
                    setCheckValues({}); 
                    setBlockReason('Transporte no autorizado por el área de cumplimiento.')
                    setBlockBlacklist(false)
                    setBlacklistVehicle(false); setBlacklistOwner(false)
                    setShowApprove(true) }}
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

            {guide && (
              <div className="detail-qr-card">
                <p className="detail-card-title">Guía de despacho</p>
                {guide.qr_image_url && !isCancelled && (
                  <img src={`${API_BASE}${guide.qr_image_url}`} alt="Código QR de despacho" className="detail-qr-image" />
                )}
                <p className="detail-empty-inline" style={{ textAlign: 'center', marginTop: 8 }}>
                  {isCancelled ? 'Guía sin validez (retiro anulado)'
                    : guide.status === 'used' ? 'Ya utilizada'
                    : guide.status === 'in_plant' ? 'En planta: pendiente de salida'
                    : 'Escanear en portería'}
                </p>
                <p className="detail-empty-inline">{guide.cargo_detail}</p>
                {guide.balance_detail && <p className="detail-empty-inline">{guide.balance_detail}</p>}
                {guide.entered_at && <p className="detail-empty-inline">Ingreso a planta: {formatDateTime(guide.entered_at)}</p>}
                {guide.used_at && <p className="detail-empty-inline">Salida de planta: {formatDateTime(guide.used_at)}</p>}
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
                    setFormError('')
                    setHint((h) => ({ ...h, vehicle: false }))
                    setBlocked((b) => ({ ...b, vehicle: null }))
                  }}
                  onBlur={lookupVehicle}
                  maxLength={6}
                />
              </label>
      
              <label className="edit-field">Tipo
                <select 
                  value={form.type} 
                  onChange={(e) => {
                    set('type')(e)
                    if (!assignment && !qtyTouched) applySuggestion(e.target.value)
                  }}>
                  <option value="">Selecciona</option>
                    {vehicleTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </label>
            </div>
      
            {/* Aviso sobre la capacidad del vehículo */}
            {fit.level !== 'unknown' && (
              <p className={`capacity-hint is-${fit.level}`}>{fit.message}</p>
            )}

            {!assignment && (
              <>
                <p className="edit-section">Cantidades de este retiro</p>

                {pendingLines.map((l) => (
                  <label className="edit-field" key={l.item.id}>
                    {l.product?.name || 'Producto'} (pendiente: {l.product ? formatQuantity(l.pending, l.product, l.parent) : l.pending})
                    <input
                      type="number" min="0" max={l.pending} step="1"
                      value={qty[l.item.id] ?? ''}
                      onChange={(e) => { setQty({ ...qty, [l.item.id]: e.target.value }); setQtyTouched(true); setFormError('') }}
                    />
                  </label>
                ))}

                {suggestion && !suggestion.complete && (
                  <p className="edit-note">
                    Lo pendiente no cabe en un solo viaje de este vehículo: se necesitarán unos {suggestion.trips} retiros.
                  </p>
                )}

                {/* {selectedType?.capacity_kg && (
                  <button 
                    type="button" 
                    className="suggest-btn" 
                    onClick={() => applySuggestion(form.type)}
                  >
                    Sugerir según el vehículo
                  </button>
                )} */}
              </>
            )}

            {hint.vehicle && (
              <p className="edit-note">Datos cargados de un registro anterior. Revísalos y corrígelos si algo cambió.</p>
            )}
      
            {blocked.vehicle && (
              <p className="detail-error-text">
                {blocked.vehicle === 'owner' ? 'El dueño de este vehículo' : 'Este vehículo'} no está autorizado para
                realizar el transporte. Si tienes dudas, comunícate con Logística.
              </p>
            )}
      
            <p className="edit-section">Dueño del vehículo</p>
            <label style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <input 
                type="checkbox" 
                checked={ownerIsCarrier} 
                onChange={(e) => { 
                  setOwnerIsCarrier(e.target.checked)
                  if (e.target.checked) { setBlocked((b) => ({ ...b, owner: false })); setHint((h) => ({ ...h, owner: false })) }
                  setFormError('')}}
              />
              El transportador es el dueño del vehículo
            </label>

            {!ownerIsCarrier && (
              <>
                <div className="edit-row">
                  <label className="edit-field">Tipo de documento
                    <select
                      value={form.owner_document_type}
                      onChange={(e) => {
                        const type = e.target.value 
                        setForm({
                          ...form, 
                          owner_document_type: type,
                          // al pasar a NIT se dejan solo los digitos en el número que ya estaba escrito
                          owner_document_id: type === 'NIT' ? form.owner_document_id.replace(/\D/g, '') : form.owner_document_id,        
                        })
                        setFormError('')
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
                      placeholder={form.owner_document_type === 'NIT' ? 'NIT sin dígito de verificación' : ''}
                      onChange={(e) => {
                        const value = form.owner_document_type === 'NIT' ? e.target.value.replace(/\D/g, '') : e.target.value
                        setForm({ ...form, owner_document_id: value })
                        setFormError('')
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
                  <p className="detail-error-text">
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
              <label className="edit-field">Dirección de residencia
                <input value={form.address} onChange={set('address')} maxLength={200} />
              </label>
            </div>
          </div>
          
          {needsChangeReason && (
            <label className="edit-field">Motivo del cambio
              <input
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Ej: el transportador registrado no pudo ir"
              />
            </label>
          )}

          {formError && ! blocked.vehicle && !blocked.carrier && !blocked.owner && (
            <p className="detail-error-text">{formError}</p>
          )}   
            
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
              disabled={busy || formBlocked}
            >
              {busy === 'submit' ? 'Enviando...' : canCorrect ? 'Guardar cambio' : assignment ? 'Reenviar' : 'Enviar'}
            </button>
          
          </div>
        </Modal>
      )}
      
      {showApprove && (
        <Modal
          title={postReview ? 'Registrar consultas del cambio' : 'Verificar y aprobar transporte'}
          onClose={closeApprove}
        >
          <p className="edit-note">
            Consulta cada fuente con el dato indicado y registra el resultado. Marca "Sí" solo si confirmaste que el documento tiene registros. Un hallazgo en listas vinculantes impide aprobar; las multas y antecedentes se registran y se le avisan al cliente.
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

          {postReview ? (
            <>
              {hasFindings && (
                <>
                  <p className="detail-error-text">
                    Hay hallazgos. Decide si vetas a alguien y escribe el motivo.
                  </p>

                  <label className="pay-label" htmlFor="post-reason">Motivo (uso interno)</label>
                  <textarea
                    id="post-reason" className="pay-textarea" rows={2} value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />

                  <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 8 }}>
                    <input type="checkbox" checked={blockBlacklist} onChange={(e) => setBlockBlacklist(e.target.checked)} />
                    Vetar al transportador: no podrá volver a ingresar a la planta
                  </label>

                  {vehicleBanBox}
                  {ownerBanBox}
                </>
              )}

              <div className="pay-actions">
                <button type="button" className="pay-btn" onClick={closeApprove} disabled={isBusy}>Cancelar</button>
                <button
                  type="button" className="pay-btn is-primary"
                  disabled={!checksComplete || isBusy}
                  onClick={handleCompleteReview}
                >
                  {busy === 'complete-review' ? 'Guardando...' : 'Registrar consultas'}
                </button>
              </div>
            </>
          ) : blockingHit ? (
            <>
              <p className="detail-error-text">
                Hay un hallazgo en listas vinculantes: este transporte no se puede aprobar. Se rechazará y la consulta
                quedará registrada.
              </p>

              <label className="pay-label" htmlFor="block-reason">Motivo del rechazo (lo verá el cliente)</label>
              <textarea
                id="block-reason" className="pay-textarea" rows={2} value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <p className="edit-note">Escribe un motivo general: el detalle no lo verá el cliente.</p>

              <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 8 }}>
                <input type="checkbox" checked={blockBlacklist} onChange={(e) => setBlockBlacklist(e.target.checked)} />
                Vetar al transportador: no podrá volver a ingresar a la planta
              </label>

              {vehicleBanBox}
              {ownerBanBox}

              <div className="pay-actions">
                <button type="button" className="pay-btn" onClick={() => closeApprove()} disabled={isBusy}>Cancelar</button>
                <button
                  type="button" className="pay-btn is-danger"
                  disabled={!blockReason.trim() || !findingsHaveNotes || isBusy}
                  onClick={handleRejectForFinding}
                >
                  {busy === 'reject-finding' ? 'Rechazando...' : 'Rechazar transporte'}
                </button>
              </div>
            </>
          ) : (
            <>
              {hasFindings && (
                <p className="detail-empty-inline pay-hint">Hay hallazgos: se registrarán y se le avisará al cliente.</p>
              )}
              <div className="pay-actions">
                <button type="button" className="pay-btn" onClick={() => closeApprove()} disabled={isBusy}>Cancelar</button>
                <button type="button" className="pay-btn is-primary" disabled={!checksComplete || isBusy} onClick={handleApprove}>
                  {busy === 'approved' ? 'Aprobando...' : 'Aprobar transporte'}
                </button>
              </div>
            </>
          )}

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

          {vehicleBanBox}
          {ownerBanBox}

          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setShowReject(false)} disabled={busy}>Cancelar</button>
            <button
              type="button" 
              className="pay-btn is-primary" 
              disabled={!reason.trim() || isBusy}
              onClick={handleReject}
            >
              {busy === 'reject' ? 'Rechazando...' : 'Rechazar'}
            </button>
          </div>
        </Modal>
      )}
      
      {/* {showCancel && (
        <Modal title="Anular retiro" onClose={() => setShowCancel(false)}>
          <p className="detail-empty-inline">Las cantidades de este retiro quedarán libres para programarlas de nuevo.</p>
          <label className="pay-label" htmlFor="cancel-withdrawal-reason">Motivo (obligatorio)</label>
          <textarea
            id="cancel-withdrawal-reason" className="pay-textarea" rows={3} value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setShowCancel(false)} disabled={isBusy}>Volver</button>
            <button
              type="button" className="pay-btn is-danger"
              disabled={!cancelReason.trim() || isBusy} onClick={handleCancel}
            >
              {busy === 'cancel' ? 'Anulando...' : 'Anular retiro'}
            </button>
          </div>
        </Modal>
      )} */}

      {docToReject && (
        <Modal title={`Rechazar: ${docToReject.label}`} onClose={() => setDocToReject(null)}>
          <label className="edit-field">Motivo (lo verá el cliente)
            <select value={docReasonChoice} onChange={(e) => setDocReasonChoice(e.target.value)}>
              <option value="">Selecciona un motivo</option>
              {docReasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER_REASON}>Otro motivo...</option>
            </select>
          </label>

          {docReasonChoice === OTHER_REASON && (
            <textarea
              className="pay-textarea" rows={3} value={docReason}
              onChange={(e) => setDocReason(e.target.value)} placeholder="Describe el motivo"
            />
          )}

          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setDocToReject(null)} disabled={isBusy}>Cancelar</button>
            <button
              type="button" className="pay-btn is-primary" disabled={!finalDocReason || isBusy}
              onClick={() => handleReviewDoc(docToReject.doc, 'rejected', finalDocReason)}
            >
              {busy === 'review' ? 'Rechazando...' : 'Rechazar documento'}
            </button>
          </div>
        </Modal>
      )}
      
      {pendingUpload && (
        <Modal title={`Subir: ${pendingUpload.label}`} onClose={() => setPendingUpload(null)}>
          <p className="edit-note">Archivo: {pendingUpload.file.name}</p>

          <label className="edit-field">Fecha de vencimiento (la que figura en el documento)
            <input type="date" min={todayISO()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
          <p className="edit-note">Se comparará con el documento: si no coincide, se rechaza.</p>

          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setPendingUpload(null)} disabled={isBusy}>Cancelar</button>
            <button
              type="button" className="pay-btn is-primary" disabled={!expiryDate || isBusy}
              onClick={() => handleUpload(pendingUpload.key, pendingUpload.file, expiryDate)}
            >
              {busy === 'upload' ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        </Modal>
      )}

      {preview && <FilePreviewModal {...preview} onClose={() => setPreview(null)} />}
    </>
  )
}