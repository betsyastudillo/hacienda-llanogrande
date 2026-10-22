import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './CollapsibleCard.css'

export default function CollapsibleCard({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  // Cuando el pedido avanza y esta pasa a ser la tarjeta activa, se abre sola
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  return (
    <div className="detail-card">
      <button type="button" className="cc-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="detail-card-title cc-title">{title}</span>
        {summary && <span className="cc-summary">{summary}</span>}
        <ChevronDown size={18} className={`cc-chevron ${open ? 'is-open' : ''}`} />
      </button>

      {open && <div className="cc-body">{children}</div>}
    </div>
  )
}