import { useState } from 'react'
import { ORDER_STATUS_STEPS, STATUS_DESCRIPTIONS, STATUS_COLORS } from '../../constants/orderStatus'
import './StatusHelpPopover.css'

export default function StatusHelpPopover() {
  const [open, setOpen] = useState(false)

  return (
    <div className="status-help-wrapper">
      <button
        type="button"
        className="status-help-toggle"
        onClick={() => setOpen(!open)}
      >
        Estado ⓘ
      </button>

      {open && (
        <>
          <div className="status-help-backdrop" onClick={() => setOpen(false)} />
          <div className="status-help-panel">
            <p className="status-help-title">Estados del pedido:</p>
            {ORDER_STATUS_STEPS.map((step) => (
              <div key={step.key} className="status-help-row">
                <span
                  className="status-help-dot"
                  style={{ backgroundColor: STATUS_COLORS[step.key]?.bg }}
                />
                <div className='status-help'>
                  <p className="status-help-abrev">{step.abrev}: </p>
                  <p className="status-help-label">{step.label}</p>
                  {/* <p className="status-help-desc">{STATUS_DESCRIPTIONS[step.key]}</p> */}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}