import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function MagicLogin() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Enlace inválido')
      return
    }

    api.get(`/magic-links/verify/${token}`)
      .then((res) => {
        login(res.data.access_token)
        navigate('/orders/new')
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Este enlace ya no es válido')
      })
  }, [searchParams])

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Verificando enlace...</p>
    </div>
  )
}