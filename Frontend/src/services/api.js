import axios from 'axios'

export const API_BASE_URL = `http://${window.location.hostname}:8000`

const api = axios.create({
  baseURL: API_BASE_URL,
})

let onSessionInvalid = null
export const setSessionInvalidHandler = (fn) => {
  onSessionInvalid = fn
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const detail = String(error.response?.data?.detail || '')
    const url = error.config?.url || ''

    // En el login, un 401 significa "credenciales incorrectas", no sesión vencida
    const isAuthRequest = url.includes('/auth/login') || url.includes('/magic-links/verify')

    if (onSessionInvalid && !isAuthRequest) {
      if (status === 401) {
        onSessionInvalid('Tu sesión expiró. Inicia sesión de nuevo.')
      } else if (status === 403 && detail.includes('desactivada')) {
        // Mensaje que lanza get_current_user cuando la empresa fue desactivada
        onSessionInvalid(detail)
      }
    }

    return Promise.reject(error)
  }
)

export default api