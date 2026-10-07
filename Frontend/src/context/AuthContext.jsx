import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'


const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('access_token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    if(!token) {
      setLoading(false)
      return
    }

    // si ya hay un perfil cargado (se renueva el token), no se vuelve a pedir
    if (user) return

    api.get('/users/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        const status = err.response?.status
        const detail = String(err.response?.data?.detail || '')

        if (status === 401) {
          sessionStorage.setItem('session_message', 'Tu sesión expiró. Inicia sesión de nuevo.')
        } else if (status === 403 && detail.includes('desactivada')){
          sessionStorage.setItem('session_message', detail)
        }
        
        localStorage.removeItem('access_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])


  const login = (accessToken) => {
    localStorage.setItem('access_token', accessToken)
    setToken(accessToken)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setToken(null)
    setUser(null)
  }

  const renewToken = (newToken) => {
    localStorage.setItem('access_token', newToken)
    setToken(newToken)
  }

  const hasPermission = (permission) => {
    if (!user) return false
    return user.permissions.includes('*') || user.permissions.includes(permission)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, renewToken, hasPermission, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}