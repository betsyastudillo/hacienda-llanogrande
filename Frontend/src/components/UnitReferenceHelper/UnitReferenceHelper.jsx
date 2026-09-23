import { useState } from 'react'
import './UnitReferenceHelper.css'

const UNIT_REFERENCES = [
  { unit: 'Canasta Manzana (fruta firme)', approx: '20 – 30 kg' },
  { unit: 'Canasta Ají', approx: '20 – 25 kg' },
  { unit: 'Canasta Uva (poco profunda)', approx: '10 – 12 kg (hasta 22 kg en diseños especiales)' },
  { unit: 'Bulto Manzana', approx: '18 – 22 kg' },
  { unit: 'Bulto Ají', approx: '10 – 15 kg' },
  { unit: 'Bulto Uva', approx: '8 – 12 kg' },
  { unit: 'Tonelada', approx: '1.000 kg' },
  { unit: 'Unidad', approx: 'Se cuenta directo, sin conversión' },
]

export default function UnitReferenceHelper() {
  const [open, setOpen] = useState(false)

  return (
    <div className="unit-ref-wrapper">
      <button
        type="button"
        className="unit-ref-toggle"
        onClick={() => setOpen(!open)}
      >
        ¿Cuánto pesa aproximadamente? ⓘ
      </button>

      {open && (
        <div className="unit-ref-panel">
          <p className="unit-ref-title">Referencia aproximada</p>
          
          {UNIT_REFERENCES.map((row) => (
            <div key={row.unit} className='unit-ref-row'>
              <span className='unit-ref-label'>{row.unit}</span>
              <span className='unit-ref-value'>{row.approx}</span>
            </div>
          ))}
          <p className="unit-ref-note">
            Estos valores son solo una guía general — el peso real depende del producto y del tamaño de la canasta o caja.
          </p>
        </div>
      )}
    </div>
  )
}