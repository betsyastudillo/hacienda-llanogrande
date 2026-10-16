import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, X } from 'lucide-react'
import './Toast.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [popup, setPopup] = useState(null)
  const timer = useRef(null)
  const nextId = useRef(0)

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setPopup(null)
  }, [])

  // Si llega un aviso nuevo mientras hay uno abierto, lo reemplaza
  const showToast = useCallback((message, type = 'success', duration) => {
    clearTimeout(timer.current)
    const ms = 6000
    setPopup({id: ++nextId.current, message, type, ms })
    timer.current = setTimeout(() => setPopup(null), ms)
  }, [popup, dismiss])

  useEffect(() => () => clearTimeout(timer.current), [])

  const Icon = popup?.type === 'error' ? CircleX : CircleCheck

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      { popup && (
        <div className='fb-overlay' onClick={dismiss}>
          <div
            key={popup.id}
            className={`fb-box fb-${popup.type}`}
            role='alertdialog'
            aria-live='assertive'
            onClick={(e) => e.stopPropagation()}
          >
            <Icon className='fb-icon' size={38} />
            <p className='fb-message'>{popup.message}</p>
            <button type='button' className='fb-btn' onClick={dismiss}>Entendido</button>
            <div className='fb-progress' style={{animationDuration: `${popup.ms}ms`}} />
          </div>
        </div>
      )}
      </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)