import { Fragment } from 'react'
import './ComplianceTable.css'

// items: [{ key, label }]
// values: { [key]: { has_findings: true | false | null, note: '' } }
// onChange(key, patch): patch es { has_findings, note }
export default function ComplianceTable({ title, group, items, values, onChange, disabled = false }) {
  return (
    <div className="ct-block">
      {title && <p className="company-form-section-title">{title}</p>}

      <table className="ct-table">
        <thead>
          <tr>
            <th rowSpan={2}>Lista consultada</th>
            <th colSpan={2} className="ct-center">¿Se encontró?</th>
          </tr>
          <tr>
            <th className="ct-center">Sí</th>
            <th className="ct-center">No</th>
          </tr>
        </thead>

        <tbody>
          {items.map(({ key, label }) => {
            const v = values[key] || { has_findings: null, note: '' }
            const name = `${group}-${key}`

            return (
              <Fragment key={key}>
                <tr>
                  <td>{label}</td>
                  <td className="ct-center">
                    <input
                      type="radio"
                      name={name}
                      aria-label={`${label}: sí se encontró`}
                      checked={v.has_findings === true}
                      onChange={() => onChange(key, { has_findings: true })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="ct-center">
                    <input
                      type="radio"
                      name={name}
                      aria-label={`${label}: no se encontró`}
                      checked={v.has_findings === false}
                      onChange={() => onChange(key, { has_findings: false, note: '' })}
                      disabled={disabled}
                    />
                  </td>
                </tr>

                {v.has_findings === true && (
                  <tr className="ct-note-row">
                    <td colSpan={3}>
                      <textarea
                        className="ct-note"
                        rows={2}
                        placeholder="¿Qué se encontró?"
                        value={v.note || ''}
                        onChange={(e) => onChange(key, { note: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}