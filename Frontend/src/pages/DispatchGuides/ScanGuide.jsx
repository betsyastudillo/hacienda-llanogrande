import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'

// Acepta la URL completa del QR o solo el token
const extractToken = (text) => {
  const value = text.trim()
  const match = value.match(/dispatch-guides\/verify\/([^/?#\s]+)/)
  if (match) return match[1]
  return /^[\w-]{20,}$/.test(value) ? value : null
}

export default function ScanGuide() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  const goTo = (text) => {
    const token = extractToken(text)
    if (!token) return setError('Este QR no corresponde a una guía de despacho')
    navigate(`/dispatch-guides/verify/${token}`)
  }

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')

    const starting = scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => goTo(text),
        () => {}
      )
      .catch(() =>
        setError('No se pudo abrir la cámara. Revisa el permiso o escribe el código abajo.')
      )

    // Se espera a que termine de arrancar antes de detenerla, para no dejar la cámara encendida
    return () => {
      starting
        .then(() => scanner.stop())
        .then(() => scanner.clear())
        .catch(() => {})
    }
  }, [])

  return (
    <main>
      <h1>Escanear guía</h1>
      <div id="qr-reader" style={{ width: '100%', maxWidth: 360 }} />
      {error && <p className="error-text">{error}</p>}

      <div>
        <p>¿No funciona la cámara? Pega el enlace o el código:</p>
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Enlace o código de la guía" />
        <button type="button" onClick={() => goTo(manual)} disabled={!manual}>Buscar</button>
      </div>
    </main>
  )
}