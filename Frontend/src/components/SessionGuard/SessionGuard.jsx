import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { setSessionInvalidHandler } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { getTokenExpiry } from '../../utils/jwt'
import ConfirmModal from '../ConfirmModal/ConfirmModal'

const WARNING_SECONDS = 120

export default function SessionGuard() {
  const { token, renewToken, logout } = useAuth()
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [renewing, setRenewing] = useState(false)

  const endSession = (message) => {
    if (message) sessionStorage.setItem('session_message', message)
    setSecondsLeft(null)
    logout()
    navigate('/login', { state: { message } })
  }

  // Red de seguridad: cualquier 401 (o empresa desactivada) cierra la sesión
  useEffect(() => {
    setSessionInvalidHandler(endSession)
    return () => setSessionInvalidHandler(null)
  })

  // Temporizador basado en la fecha real de vencimiento del token
  useEffect(() => {
    if (!token) return
    const expiry = getTokenExpiry(token)
    if (!expiry) return

    const tick = () => {
      const remaining = Math.floor((expiry - Date.now()) / 1000)

      if (remaining <= 0) {
        endSession('Tu sesión expiró. Inicia sesión de nuevo.')
      } else if (remaining <= WARNING_SECONDS) {
        setSecondsLeft(remaining)
      } else {
        setSecondsLeft(null)
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [token])

  const handleContinue = async () => {
    setRenewing(true)
    try {
      const res = await api.post('/auth/refresh')
      renewToken(res.data.access_token)
      setSecondsLeft(null)
    } catch {
      // Si falla, el token ya venció: el interceptor o el temporizador cierran la sesión
    } finally {
      setRenewing(false)
    }
  }

  if (secondsLeft === null) return null

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  return (
    <ConfirmModal
      title="Tu sesión está por vencer"
      confirmLabel="Continuar"
      cancelLabel="Cerrar sesión"
      onConfirm={handleContinue}
      onCancel={() => endSession()}
      loading={renewing}
      dismissible={false}
    >
      Por seguridad, tu sesión se cerrará en <strong>{minutes}:{seconds}</strong>. ¿Quieres continuar en la sesión?
    </ConfirmModal>
  )
}