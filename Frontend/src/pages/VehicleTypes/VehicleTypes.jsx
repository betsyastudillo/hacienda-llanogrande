import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useToast } from '../../context/Toast/ToastContext'
import Modal from '../../components/Modal/Modal'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { Pencil, Power, Trash } from 'lucide-react'
import './VehicleTypes.css'
export default function VehicleTypes() {
  const { showToast } = useToast()
  const [types, setTypes] = useState([])
  const [editing, setEditing] = useState(null)   // null = cerrado, {} = nuevo, {id,...} = editar
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.get('/vehicle-types/', { params: { include_inactive: true } }).then((r) => setTypes(r.data))

  useEffect(() => { load() }, [])

  const openForm = (t) => { setEditing(t); setName(t.name || '') }

  async function save() {
    setSaving(true)
    try {
      if (editing.id) await api.patch(`/vehicle-types/${editing.id}`, { name })
      else await api.post('/vehicle-types/', { name })
      showToast(editing.id ? 'Tipo actualizado.' : 'Tipo creado.')
      setEditing(null)
      await load()
    } catch (err) {
      showToast(getErrorMessage(err, 'No se pudo guardar el tipo'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(t) {
    try {
      await api.patch(`/vehicle-types/${t.id}`, { is_active: !t.is_active })
      showToast(t.is_active ? 'Tipo desactivado.' : 'Tipo activado.')
      await load()
    } catch (err) {
      showToast(getErrorMessage(err, 'No se pudo cambiar el estado'), 'error')
    }
  }

  return (
    <main className="inventory-main">
      <div className='inventory-header'>
        <h1 className="inventory-title">Tipos de vehículo</h1>
        <button type="button" className="inventory-create-btn" onClick={() => openForm({})}>
          Nuevo tipo
        </button>
      </div>

      <div className='inventory-table-wrapper'>
        <table className='inventory-table'>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Capacidad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr 
                key={t.id} 
                // className="detail-info-row"
                >
                <td>{t.name}{!t.is_active && ' (inactivo)'}</td>
                <td>{t.name}{!t.is_active && ' (inactivo)'}</td>
                <td>
                  <div className='inventory-actions'>
                    <button type='button' className='inventory-icon-btn'
                      title='Editar' onClick={() => openForm(t)}>
                      <Pencil size={16} />
                    </button>
                    <button type='button' className='inventory-icon-btn'
                      title='Desactivar' onClick={() => toggle(t)}>
                      <Trash size={16} />
                      {/* {t.is_active ? 'Desactivar' : 'Activar'} */}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inventory-history-card">
      </div>

      {editing && (
        <Modal title={editing.id ? 'Editar tipo' : 'Nuevo tipo de vehículo'} onClose={() => setEditing(null)}>
          <label className="edit-field">Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          </label>
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button type="button" className="pay-btn is-primary" onClick={save} disabled={saving || name.trim().length < 2}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}