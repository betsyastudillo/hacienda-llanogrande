import { useRef, useState } from 'react'
import api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/Toast/ToastContext'
import Modal from '../../../components/Modal/Modal'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import StatusBadge from '../../../components/StatusBadge/StatusBadge'
import FilePreviewModal from '../../../components/FilePreviewModal/FilePreviewModal'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_ICONS } from '../../../constants/paymentStatus'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatDate } from '../../../utils/formatDate'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { formatAccountNumber } from '../../../utils/formatAccountNumber'

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
const MAX_SIZE = 5 * 1024 * 1024

export default function PaymentCard({ order, payment, bankAccount, onChanged }) {
  const { hasPermission } = useAuth()
  const { showToast } = useToast()
  const fail = (message) => showToast(message, 'error')
  const fileInputRef = useRef(null)

  const [showCreate, setShowCreate] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)

  const canCreate = hasPermission('payment:crear') || hasPermission('payment:crear_propio')
  const canUpload = hasPermission('payment:subir_comprobante')
  const canConfirm = hasPermission('payment:confirmar')

  async function openCreate() {
    setSelectedAccountId('')
    setShowCreate(true)
    try {
      const res = await api.get('/bank-accounts/')
      setAccounts(res.data.filter((a) => a.is_active))
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudieron cargar las cuentas bancarias'))
    }
  }

  async function handleCreate() {
    setBusy(true)
    try {
      await api.post('/payments/', { order_id: order.id, bank_account_id: selectedAccountId })
      setShowCreate(false)
      showToast('Proforma generada. Consigna el valor y sube el comprobante.')
      await onChanged()
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudo generar la proforma'))
    } finally {
      setBusy(false)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(extension)) return fail('El comprobante debe ser PDF, JPG, PNG o WEBP.')
    if (file.size > MAX_SIZE) return fail('El comprobante debe pesar máximo 5 MB.')

    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/payments/${payment.id}/receipt`, formData)
      showToast('Comprobante subido. Quedó en revisión por cartera.')
      await onChanged()
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudo subir el comprobante'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDecision(status, reason) {
    setBusy(true)
    try {
      await api.post(`/payments/${payment.id}/confirm`, { status, reason })
      setShowConfirm(false)
      setShowReject(false)
      setRejectReason('')
      showToast(status === 'confirmed' ? 'Pago confirmado.' : 'Pago rechazado.')
      await onChanged()
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudo registrar la decisión del pago'))
    } finally {
      setBusy(false)
    }
  }

  const openProforma = () => setPreview({
    title: `Proforma ${payment.proforma_number}`,
    apiPath: `/payments/${payment.id}/proforma`,
    filename: `${payment.proforma_number}.pdf`,
  })

  // Sin proforma
  if (!payment) {
    return (
      <div className="detail-card">
        <p className="detail-card-title">Pago</p>
        <p className="detail-empty-inline">Aún no se ha generado la proforma de pago.</p>

        {order.status === 'created' && canCreate && (
          <button className="pay-btn is-primary" onClick={openCreate}>
            Elegir medio de pago
          </button>
        )}

        {showCreate && (
          <Modal title="Elige la cuenta para consignar" onClose={() => setShowCreate(false)}>
            <div className="pay-account-list">
              {accounts.length === 0 && <p className="detail-empty-inline">No hay cuentas disponibles.</p>}
              {accounts.map((a) => (
                <label
                  key={a.id}
                  className={`pay-account-option ${selectedAccountId === a.id ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="bank-account"
                    checked={selectedAccountId === a.id}
                    onChange={() => setSelectedAccountId(a.id)}
                  />
                  <span className='pay-account-number'>
                    <strong>{a.bank_name.toUpperCase()} · CUENTA {a.account_type.toUpperCase()}</strong>
                    <br />
                    {a.agreement_number ? (
                      <p>
                        Convenio: {a.agreement_number}
                      </p>
                      ) : ( 
                        <p>
                          Cuenta:                           {formatAccountNumber(a.account_number)}
                        </p>
                      )}
                  </span>
                </label>
              ))}
            </div>
            <div className="pay-actions">
              <button className="pay-btn" onClick={() => setShowCreate(false)} disabled={busy}>
                Cancelar
              </button>
              <button className="pay-btn is-primary" onClick={handleCreate} disabled={!selectedAccountId || busy}>
                {busy ? 'Generando...' : 'Generar proforma'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  const awaitingReceipt = payment.status === 'pending' || payment.status === 'failed'

  return (
    <div className="detail-card">
      <p className="detail-card-title">Pago</p>

      <div className="detail-info-list">
        <div className="detail-info-row">
          <span>Referencia</span>
          <span>{payment.proforma_number}</span>
        </div>

        <div className="detail-info-row">
          <span>Valor</span>
          <span>{formatCurrency(payment.amount)}</span>
        </div>
        <div className="detail-info-row">
          <span>Estado</span>
          <StatusBadge
            label={PAYMENT_STATUS_LABELS[payment.status]}
            bgColor={PAYMENT_STATUS_COLORS[payment.status].bgColor}
            textColor={PAYMENT_STATUS_COLORS[payment.status].textColor}
            icon={PAYMENT_STATUS_ICONS[payment.status]}
          />
        </div>

        {bankAccount && awaitingReceipt && (
          <>
            <div className="detail-info-row"><span>Titular</span><span>{bankAccount.account_holder_name}</span></div>
            <div className="detail-info-row"><span>Banco</span><span>{bankAccount.bank_name}</span></div>
            <div className="detail-info-row"><span>Tipo</span><span>{bankAccount.account_type}</span></div>
            {bankAccount.agreement_number ? (
              <div className="detail-info-row"><span>Convenio</span><span>{bankAccount.agreement_number}</span></div>
            ) : (
              <div className="detail-info-row"><span>Cuenta</span><span>{bankAccount.account_number}</span></div>
            )}
          </>
        )}

        {payment.pdf_url && (
          <div className='detail-info-row'>
            <span>Proforma</span>
            <button
              type="button"
              className="pay-link"
              onClick={openProforma}
            >
              Ver archivo
            </button>
          </div>
        )}

        {payment.status === 'failed' && payment.rejection_reason && (
          <div className="detail-info-row">
            <span>Motivo</span>
            <span className="pay-reason">{payment.rejection_reason}</span>
          </div>
        )}

        {payment.status === 'confirmed' && payment.confirmed_at && (
          <div className="detail-info-row">
            <span>Confirmado el</span>
            <span>{formatDate(payment.confirmed_at)}</span>
          </div>
        )}

        {payment.receipt_url && (
          <div className="detail-info-row">
            <span>Comprobante</span>
            <button
              type="button"
              className="pay-link"
              onClick={() => setPreview({ title: 'Comprobante de pago', fileUrl: payment.receipt_url })}
            >
              Ver archivo
            </button>
          </div>
        )}
      </div>

      {payment.status === 'pending' && !payment.receipt_url && canUpload && (
        <p className="detail-empty-inline pay-hint">
          Consigna el valor exacto a la cuenta indicada y sube aquí el comprobante.
        </p>
      )}
      {payment.status === 'pending' && payment.receipt_url && !canConfirm && (
        <p className="detail-empty-inline pay-hint">Comprobante recibido, en revisión por cartera.</p>
      )}

      <div className="pay-actions">
        {awaitingReceipt && canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              hidden
              onChange={handleFileChange}
            />
            <button
              className={'pay-btn is-primary'}
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Subiendo...' : payment.receipt_url ? 'Reemplazar comprobante' : 'Subir comprobante'}
            </button>
          </>
        )}

        {payment.status === 'pending' && payment.receipt_url && canConfirm && (
          <div className='pay-decision'>
            <button className="pay-btn is-danger" onClick={() => setShowReject(true)} disabled={busy}>
              Rechazar
            </button>
            <button className="pay-btn is-confirm" onClick={() => setShowConfirm(true)} disabled={busy}>
              Confirmar
            </button>
          </div>
        )}
      </div>

      {showConfirm && (
        <ConfirmModal
          isOpen={showConfirm}
          title="Confirmar pago"
          children={`¿Confirmas que recibiste ${formatCurrency(payment.amount)} de este pedido?`}
          confirmLabel="Confirmar pago"
          loading={busy}
          onConfirm={() => handleDecision('confirmed')}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showReject && (
        <Modal title="Rechazar pago" onClose={() => setShowReject(false)}>
          <label className="pay-label" htmlFor="reject-reason">
            Motivo (visible para el cliente)
          </label>
          <textarea
            id="reject-reason"
            className="pay-textarea"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ej: imagen ilegible, el valor no coincide"
          />
          <div className="pay-actions">
            <button className="pay-btn" onClick={() => setShowReject(false)} disabled={busy}>
              Cancelar
            </button>
            <button
              className="pay-btn is-danger"
              onClick={() => handleDecision('failed', rejectReason.trim())}
              disabled={!rejectReason.trim() || busy}
            >
              {busy ? 'Rechazando...' : 'Rechazar pago'}
            </button>
          </div>
        </Modal>
      )}

      {preview && <FilePreviewModal {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}