import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../services/api'
import { useToast } from '../../context/Toast/ToastContext'
import Modal from '../../components/Modal/Modal'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { formatDate } from '../../utils/formatDate'
import './VerifyGuide.css'

const STATUS_CONFIG = {
  pending: { label: 'Pendiente de ingreso', className: 'is-pending' },
  in_plant: { label: 'En planta', className: 'is-in-plant' },
  used: { label: 'Guía utilizada', className: 'is-used' },
}

export default function VerifyGuide() {
  const { token } = useParams()
  const { showToast } = useToast()

  const [guide, setGuide] = useState(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const res = await api.get(`/dispatch-guides/verify/${token}`)
      console.log(res.data)
      setGuide(res.data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo consultar la guía'))
    }
  }

  useEffect(() => { load() }, [token])

  const act = async (path, okMessage) => {
    setBusy(true)
    try {
      const res = await api.post(`/dispatch-guides/verify/${token}/${path}`)
      setGuide(res.data)
      showToast(okMessage)
    } catch (err) {
      showToast(getErrorMessage(err, 'No se pudo registrar'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <main><p>{error}</p></main>
  if (!guide) return <main><p>Cargando...</p></main>
  const status = STATUS_CONFIG[guide.status] || { label: guide.status, className: '' }

  return (
    <main className="guide-page">
      <header className="guide-header">
        <h1 className="guide-title">Guía de despacho</h1>
        <span className={`guide-status ${status.className}`}>{status.label}</span>
      </header>

      {guide.blocked && (
        <div className="guide-alert">
          Vehículo, propietario o transportador vetado. No se permite el ingreso.
        </div>
      )}

      <section className="guide-plate-card">
        <span className="guide-label">Placa</span>
        <span className="guide-plate">{guide.vehicle_plate}</span>
        <span className="guide-plate-type">{guide.vehicle_type}</span>
      </section>

      <section className="guide-card">
        <div className="guide-field">
          <span className="guide-label">Transportador</span>
          <span className="guide-value">{guide.carrier_name}</span>
          <span className="guide-sub">Documento {guide.carrier_document}</span>
        </div>

        <div className="guide-field">
          <span className="guide-label">Origen</span>
          <span className="guide-value">{guide.origin}</span>
        </div>

        <div className="guide-field">
          <span className="guide-label">Destino</span>
          <span className="guide-value">{guide.destination}</span>
        </div>

        <div className="guide-field">
          <span className="guide-label">Carga</span>
          <span className="guide-value">{guide.cargo_detail}</span>
        </div>

        {guide.entered_at && (
          <div className="guide-field">
            <span className="guide-label">Ingreso</span>
            <span className="guide-value">{formatDate(guide.entered_at)}</span>
          </div>
        )}

        {guide.used_at && (
          <div className="guide-field">
            <span className="guide-label">Salida</span>
            <span className="guide-value">{formatDate(guide.used_at)}</span>
          </div>
        )}
      </section>

      {guide.can_enter && (
        <button className="guide-action" disabled={busy} onClick={() => act('entry', 'Ingreso registrado.')}>
          {busy ? 'Registrando...' : 'Registrar ingreso'}
        </button>
      )}

      {guide.can_exit && (
        <button className="guide-action" disabled={busy} onClick={() => setConfirmExit(true)}>
          Confirmar salida
        </button>
      )}

      {confirmExit && (
        <Modal title="Salida vehículo" onClose={() => setConfirmExit(false)}>
          <p className='guide-exit-confirm'>
            ¿Confirmas la salida del vehículo con placa: <strong>{guide.vehicle_plate}</strong>?
            {/* Se descontará del inventario y la guía quedará utilizada. */}
          </p>

          <button
            type="button"
            className="guide-action"
            disabled={busy}
            onClick={async () => {
              await act('exit', 'Salida registrada.')
              setConfirmExit(false)
            }}
          >
            {busy ? 'Registrando...' : 'Sí, confirmar'}
          </button>
        </Modal>
      )}
    </main>
  )
}