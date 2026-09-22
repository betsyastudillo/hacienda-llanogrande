import { createContext, useContext, useState, useEffect } from 'react'
import { jwtDecode } from 'jwt-decode'
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

    api.get('/users/me')
      .then((res) => setUser(res.data))
      .catch(() => {
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

  const hasPermission = (permission) => {
    if (!user) return false
    return user.permissions.includes('*') || user.permissions.includes(permission)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, hasPermission, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}