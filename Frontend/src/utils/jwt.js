import { jwtDecode } from 'jwt-decode'

export function getTokenExpiry(token) {
  try {
    const { exp } = jwtDecode(token)
    return exp ? exp * 1000 : null
  } catch {
    return null
  }
}