import { Check, Eye, Upload, X } from 'lucide-react'
import { formatDateOnly, daysLeft} from '../../../utils/formatDate'
import { EXPIRY_WARNING_DAYS } from '../../../constants/transport'
import { TRANSPORT_DOC_STATE_LABELS } from '../../../constants/transportStatus'
import { daysUntil } from '../../../utils/formatDate'
import './TransportDocuments.css'


export default function TransportDocuments({
  rows, canReview, canUpload, isBusy, busy,
  onView, onUpload, onApprove, onReject, onApproveAll,
}) {


  return (
    <div className="td">
      <div className="td-head">
        <p className="td-title">Documentos</p>
      </div>

      <ul className="td-list">
        {rows.map(({ key, label, doc, status }) => {
          // Quien revisa solo sube si falta o fue rechazado; el cliente puede reemplazar mientras no esté aprobado
          const showUpload = canUpload && status !== 'approved'
          const fileId = `td-file-${key}`

          return (
            <li key={key} className={`td-item is-${status}`}>
              <div className="td-top">
                <span className="td-name">{label}</span>

                {doc?.expires_at && (
                  <p className={`td-expiry ${status === 'expired' ? 'is-expired' : ''}`}>
                    Vence: {formatDateOnly(doc.expires_at)}
                    {status !== 'expired' &&
                      daysUntil(doc.expires_at) >= 0 &&
                      daysUntil(doc.expires_at) <= EXPIRY_WARNING_DAYS &&
                      ' · vence pronto'}
                  </p>
                )}
                {status === 'expired' && !doc?.expires_at && <p className="td-expiry is-expired">Sin fecha de vencimiento registrada</p>}

                <span className={`td-state is-${status}`}>{TRANSPORT_DOC_STATE_LABELS[status]}</span>
              </div>

              {status === 'rejected' && doc?.rejection_reason && (
                <p className="td-reason">Motivo: {doc.rejection_reason}</p>
              )}

              <div className="td-actions">
                {doc && (
                  <button type="button" className="td-btn" onClick={() => onView(label, doc)}>
                    <Eye size={14} /> Ver
                  </button>
                )}

                {showUpload && (
                  <>
                    <input
                      id={fileId} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => { onUpload(key, e.target.files[0]); e.target.value = '' }}
                    />
                    <button
                      type="button" className="td-btn" disabled={isBusy}
                      onClick={() => document.getElementById(fileId).click()}
                    >
                      <Upload size={14} /> {doc ? 'Reemplazar' : 'Subir'}
                    </button>
                  </>
                )}

                {canReview && doc && status === 'pending' && (
                  <>
                    <button type="button" className="td-btn is-ok" disabled={isBusy} onClick={() => onApprove(doc)}>
                      <Check size={14} /> Aprobar
                    </button>

                    <button type="button" className="td-btn is-no" disabled={isBusy} onClick={() => onReject(doc, label)}>
                      <X size={14} /> Rechazar
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}