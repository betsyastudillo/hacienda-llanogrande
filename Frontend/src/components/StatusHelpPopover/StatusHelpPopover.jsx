import { useState } from 'react'
import { ORDER_STATUS_STEPS, STATUS_COLORS } from '../../constants/orderStatus'
import './StatusHelpPopover.css'

export default function StatusHelpPopover({ triggerLabel, title, items}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="status-help-wrapper">
      <button
        type="button"
        className="status-help-toggle"
        onClick={() => setOpen(!open)}
      >
        {triggerLabel}
      </button>

      {open && (
        <>
          <div className="status-help-backdrop" onClick={() => setOpen(false)} />
          <div className="status-help-panel">
            <p className="status-help-title">{title}</p>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.key} className="status-help-row">
                  {Icon ? (
                    <Icon size={16} className="status-help-icon" style={{ color: item.textColor }} />
                  ) : (
                    <span className="status-help-dot" style={{ backgroundColor: item.color }} />
                  )}
                  <div className='status-help'>
                    <p className="status-help-abrev">{item.abrev}: </p>
                    <p className="status-help-label">{item.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}