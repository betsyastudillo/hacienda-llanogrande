import { useState } from 'react'
import { Eye } from 'lucide-react'
import FilePreviewModal from '../../../components/FilePreviewModal/FilePreviewModal'
import { formatDate } from '../../../utils/formatDate'
import { formatCurrency } from '../../../utils/formatCurrency'
import './OrderDetail.css'
import CollapsibleCard from '../../../components/CollapsibleCard/CollapsibleCard'

export default function InvoiceCard({ order, invoice, defaultOpen }) {
  const [preview, setPreview] = useState(null)

  const openPreview = () => setPreview({
    title: `Factura ${invoice.invoice_number}`,
    apiPath: `/invoices/${invoice.id}/pdf`,
    filename: `${invoice.invoice_number}.pdf`,
  })

  return (
    <>
      <CollapsibleCard
        title="Facturación"
        summary={invoice ? invoice.invoice_number : 'Pendiente'}
        defaultOpen={defaultOpen}
      >
        {!invoice ? (
          <p className="detail-empty-inline">
            {order.status === 'created'
              ? 'Se emitirá una vez se confirme el pago.'
              : 'Este pedido no tiene factura registrada.'}
          </p>
        ) : (
          <>
            <div className="detail-info-list">
              <div className="detail-info-row">
                <span>Número</span>
                <span>{invoice.invoice_number}</span>
              </div>
              <div className="detail-info-row">
                <span>Emitida el</span>
                <span>{formatDate(invoice.issued_at)}</span>
              </div>
              {/* <div className="detail-info-row">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div> */}
              {/* {invoice.provider === 'simulado' && (
                <div className="detail-info-row">
                  <span>Tipo</span>
                  <span>Simulación (sin validez fiscal)</span>
                </div>
              )} */}
            </div>

            <div className="pay-actions">
              <button className="pay-btn is-primary" onClick={openPreview}>
                <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Ver factura
              </button>
            </div>
          </>
        )}

      </CollapsibleCard>
      
      {preview && <FilePreviewModal {...preview} onClose={() => setPreview(null)} />}
    </>
  )
}