import { useState } from 'react'
import { Download } from 'lucide-react'
import api from '../../../services/api'
import { useToast } from '../../../context/Toast/ToastContext'
import { formatDate } from '../../../utils/formatDate'
import { formatCurrency } from '../../../utils/formatCurrency'
import './OrderDetail.css'

export default function InvoiceCard({ order, invoice }) {
  const { showToast } = useToast()
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoice_number}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      showToast('No se pudo descargar la factura.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="detail-card">
      <p className="detail-card-title">Factura electrónica</p>

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
            <button className="pay-btn is-primary" onClick={handleDownload} disabled={downloading}>
              <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {downloading ? 'Descargando...' : 'Descargar PDF'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}