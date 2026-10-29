import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import './ScrollToTop.css'

// containerSelector: solo si la página no se desplaza con la ventana sino dentro de un contenedor (ver nota abajo)
export default function ScrollToTop({ containerSelector, threshold = 300 }) {
  const [visible, setVisible] = useState(false)

  const getTarget = () => (containerSelector ? document.querySelector(containerSelector) : window)

  useEffect(() => {
    const target = getTarget()
    if (!target) return

    const getTop = () => (containerSelector ? target.scrollTop : window.scrollY)
    const onScroll = () => setVisible(getTop() > threshold)

    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [containerSelector, threshold])

  const goTop = () => getTarget()?.scrollTo({ top: 0, behavior: 'smooth' })

  if (!visible) return null

  return (
    <button type="button" className="scroll-top-btn" onClick={goTop} aria-label="Volver arriba" title="Volver arriba">
      <ArrowUp size={20} />
    </button>
  )
}