import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form } from 'react-bootstrap'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/llano_grande_logo_color.png'
import './Login.css'

export default function Login() {
  const [documentId, setDocumentId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', {
        document_id: documentId,
        password: password,
      })

      login(response.data.access_token)
      navigate('/orders')

    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError('Documento o contraseña incorrectos')
      } else {
        setError('No se pudo conectar con el servidor')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>

    <div className='login-page'>
      <div className='logo-container'>
        <div className='login-header'>
        </div>

        <div className='login-card'>
          {error && (
            <div className='login-error'> {error} </div>
          )}

          <Form onSubmit={handleSubmit}>
            <div className='login-field '>
              <div className='login-logo'>
                <img src={logo} alt='AridosCo' className='login-logo-img'></img>
              </div>
              <label className='login-label'>
                Documento
              </label>
              <input
                type='text'
                value={documentId}
                onChange={(e)=> setDocumentId(e.target.value)}
                required
                placeholder='Número de documento'
                className='login-input'
              />
            </div>
            <div className='login-field-last'>
              <label className='login-label'>
                Contraseña
              </label>
              <input
                type='password'
                value={password}
                onChange={(e)=> setPassword(e.target.value)}
                required
                placeholder='**********'
                className='login-input'
              />
            </div>
          
            <Button
              type='submit'
              disabled={loading}
              className='login-button'
            >
            {loading? 'Ingresando...' : 'Ingresar'}
            </Button>
          </Form>
        </div>

        <p className='login-footer'>
          Sistema interno · Hacienda Llanogrande
        </p>
      </div>
    </div>
    </>
  )
}