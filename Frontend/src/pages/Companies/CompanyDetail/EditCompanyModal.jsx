import { useState } from 'react'
import api from '../../../services/api'
import Modal from '../../../components/Modal/Modal'
import { useToast } from '../../../context/Toast/ToastContext'
import { DEPARTMENTS } from '../../../constants/departments'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { isValidEmail, isValidPhone, isValidAddress, MIN_ADDRESS_LENGTH } from '../../../utils/validators'

const FIELDS = [
  'display_name', 'address', 'department', 'city', 'phone', 'email',
  'economic_activity_code', 'economic_activity_description',
  'fiscal_address', 'fiscal_phone', 'fiscal_email',
  'legal_rep_name', 'legal_rep_document_type', 'legal_rep_document_number',
  'legal_rep_email', 'legal_rep_city',
]
const REP_IDENTITY = ['legal_rep_name', 'legal_rep_document_type', 'legal_rep_document_number']
const normalize = (v) => (typeof v === 'string' ? v.trim() : v) || null

export default function EditCompanyModal({ company, canApprove, onClose, onSaved }) {
  const { showToast } = useToast()
  const isJuridica = company.person_type === 'juridica'

  const [form, setForm] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f, company[f] ?? '']))
  )
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const setDigits = (field) => (e) => setForm({ ...form, [field]: e.target.value.replace(/\D/g, '') })
  const fail = (msg) => showToast(msg, 'error')

  // Solo los campos que realmente cambiaron
  const changes = {}
  FIELDS.forEach((f) => {
    const next = normalize(form[f])
    if (next !== normalize(company[f])) changes[f] = next
  })
  const hasChanges = Object.keys(changes).length > 0
  const repIdentityChanged = REP_IDENTITY.some((f) => f in changes)

  // Aviso solo para quien no puede aprobar y la empresa ya estaba aprobada
  const warning =
    company.verification_status === 'approved' && !canApprove && hasChanges
      ? repIdentityChanged
        ? 'Cambiaste el representante legal: la empresa volverá a borrador para repetir su verificación en listas, y no podrá crear pedidos hasta ser aprobada.'
        : 'Al guardar, la empresa volverá a revisión y no podrá crear pedidos hasta ser aprobada.'
      : null

  const handleSave = async () => {

    if (!hasChanges) {
      showToast('No hay cambios para guardar')
    
      return onClose()
    }

    if (!form.address.trim() || !form.department || !form.city.trim() || !form.phone || !form.email.trim())
      return fail('Dirección, departamento, ciudad, teléfono y correo son obligatorios.')
    
    if (!isValidPhone(form.phone)) return fail('El teléfono debe tener solo números (entre 7 y 15 dígitos)')
    
    if (!isValidEmail(form.email)) return fail('El correo no tiene un formato válido')

    if ('address' in changes && !isValidAddress(form.address))
      return fail(`La dirección debe tener al menos ${MIN_ADDRESS_LENGTH} caracteres.`)

    if (changes.fiscal_address && !isValidAddress(form.fiscal_address))
      return fail(`La dirección fiscal debe tener al menos ${MIN_ADDRESS_LENGTH} caracteres.`)
    
    if (form.economic_activity_code && !/^\d{4}$/.test(form.economic_activity_code))
      return fail('El código CIIU debe tener 4 dígitos')
    
    if (form.fiscal_phone && !isValidPhone(form.fiscal_phone)) return fail('El teléfono fiscal no es válido')
    
    if (form.fiscal_email && !isValidEmail(form.fiscal_email)) return fail('El correo fiscal no tiene un formato válido')

    if (isJuridica) {
    
      if (
        !form.legal_rep_name.trim() || !form.legal_rep_document_type ||
        !form.legal_rep_document_number.trim() || !form.legal_rep_email.trim() || !form.legal_rep_city.trim()
      ) return fail('Completa todos los datos del representante legal.')
    
      if (!isValidEmail(form.legal_rep_email)) return fail('El correo del representante legal no es válido')
    }

    setSaving(true)
    
    try {
      const res = await api.put(`/companies/${company.id}`, changes)
      const movedTo = res.data.verification_status
    
      showToast(
        movedTo === company.verification_status
          ? 'Datos actualizados correctamente.'
          : movedTo === 'draft'
            ? 'Datos actualizados. La empresa volvió a borrador para repetir la verificación.'
            : 'Datos actualizados. La empresa volvió a revisión.'
      )
    
      await onSaved()
      onClose()
    } catch (err) {
      fail(getErrorMessage(err, 'No se pudieron guardar los cambios'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Editar datos" onClose={onClose}>
      <div className="edit-form">
        <p className="edit-note">
          El documento, la razón social, el tipo de persona y el sector no se pueden cambiar desde aquí.
        </p>

        {isJuridica && (
          <label className="edit-field">Nombre corto
            <input value={form.display_name} onChange={set('display_name')} />
          </label>
        )}

        <label className="edit-field">Dirección
          <input value={form.address} onChange={set('address')} />
        </label>

        <div className="edit-row">
          <label className="edit-field">Departamento
            <select value={form.department} onChange={set('department')}>
              <option value="">Selecciona</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="edit-field">Ciudad
            <input value={form.city} onChange={set('city')} />
          </label>
        </div>

        <div className="edit-row">
          <label className="edit-field">Teléfono
            <input value={form.phone} onChange={setDigits('phone')} inputMode="numeric" />
          </label>
          <label className="edit-field">Correo
            <input type="email" value={form.email} onChange={set('email')} />
          </label>
        </div>

        <div className="edit-row">
          <label className="edit-field">Código CIIU
            <input value={form.economic_activity_code} onChange={setDigits('economic_activity_code')} maxLength={4} inputMode="numeric" />
          </label>
          <label className="edit-field">Actividad económica
            <input value={form.economic_activity_description} onChange={set('economic_activity_description')} />
          </label>
        </div>

        <p className="edit-section">Datos fiscales (RUT)</p>
        <label className="edit-field">Dirección fiscal
          <input value={form.fiscal_address} onChange={set('fiscal_address')} />
        </label>
        <div className="edit-row">
          <label className="edit-field">Teléfono fiscal
            <input value={form.fiscal_phone} onChange={setDigits('fiscal_phone')} inputMode="numeric" />
          </label>
          <label className="edit-field">Correo notificaciones
            <input type="email" value={form.fiscal_email} onChange={set('fiscal_email')} />
          </label>
        </div>

        {isJuridica && (
          <>
            <p className="edit-section">Representante legal</p>
            <label className="edit-field">Nombre completo
              <input value={form.legal_rep_name} onChange={set('legal_rep_name')} />
            </label>
            <div className="edit-row">
              <label className="edit-field">Tipo de documento
                <select value={form.legal_rep_document_type} onChange={set('legal_rep_document_type')}>
                  <option value="">Selecciona</option>
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="CE">Cédula de extranjería</option>
                  <option value="PP">Pasaporte</option>
                  <option value="PPT">Permiso por Protección Temporal</option>
                  <option value="PEP">Permiso Especial de Permanencia</option>
                </select>
              </label>
              <label className="edit-field">Número de documento
                <input value={form.legal_rep_document_number} onChange={set('legal_rep_document_number')} />
              </label>
            </div>
            <div className="edit-row">
              <label className="edit-field">Correo
                <input type="email" value={form.legal_rep_email} onChange={set('legal_rep_email')} />
              </label>
              <label className="edit-field">Ciudad
                <input value={form.legal_rep_city} onChange={set('legal_rep_city')} />
              </label>
            </div>
          </>
        )}
      </div>

      {warning && <p className="edit-warning">{warning}</p>}

      <div className="company-detail-approve-actions edit-actions">
        <button type="button" className="company-detail-cancel-reject-btn" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="company-detail-approve-btn" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}