import '../Modal/Modal.css'
import './ConfirmModal.css'

export default function ConfirmModal({
  title, children, confirmLabel, cancelLabel = 'Cancelar',
  onConfirm, onCancel, loading = false, dismissible = true, tone = 'primary',
}) {
  return (
    <div className="modal-backdrop" onClick={dismissible ? onCancel : undefined}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="modal-title">{title}</p>
        </div>
        <div className="modal-body">
          <div className="confirm-modal-text">{children}</div>
          <div className="confirm-modal-actions">
            <button type="button" className="confirm-modal-cancel" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </button>
            <button type="button" className={`confirm-modal-confirm is-${tone}`} onClick={onConfirm} disabled={loading}>
              {loading ? 'Procesando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}