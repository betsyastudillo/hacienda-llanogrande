import { useEffect, useState } from 'react'
import api from '../services/api'

export function useVehicleTypes() {
  const [all, setAll] = useState([])

  useEffect(() => {
    api.get('/vehicle-types/', { params: { include_inactive: true } })
      .then((res) => setAll(res.data))
      .catch(() => setAll([]))
  }, [])

  return {
    types: all.filter((t) => t.is_active),                    // para el <select>
    labelOf: (code) => all.find((t) => t.code === code)?.name || code,
  }
}