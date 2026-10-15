import { createContext, useCallback, useContext, useState } from 'react'
import { CircleCheck, CircleX, X } from 'lucide-react'
import './Toast.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // type: 'success' | 'error'. Los errores duran más para dar tiempo de leerlos
  const showToast = useCallback((message, type = 'success', duration) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), duration ?? (type === 'error' ? 4000 : 6000))
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="app-toast-container" aria-live="polite">
        {toasts.map((t) => (  
          <div key={t.id} className={`app-toast is-${t.type}`} role="status">
            {t.type === 'success' ? <CircleCheck size={18} /> : <CircleX size={18} />}
            <span className="app-toast-message">{t.message}</span>
            <button type="button" className="app-toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)