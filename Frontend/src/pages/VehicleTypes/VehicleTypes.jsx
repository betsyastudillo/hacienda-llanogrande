import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useToast } from '../../context/Toast/ToastContext'
import Modal from '../../components/Modal/Modal'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { Pencil, Power, Trash } from 'lucide-react'
import './VehicleTypes.css'

// La base guarda kg; la pantalla muestra toneladas
const toTons = (kg) => (kg ? String(Number(kg)/1000) : '')
const toKg = (tons) => (tons ? Math.round(Number(tons) * 1000) : null)

export default function VehicleTypes() {
  const { showToast } = useToast()
  const [types, setTypes] = useState([])
  const [editing, setEditing] = useState(null)  
  const [name, setName] = useState('')
  const [capacityTons, setCapacityTons] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.get('/vehicle-types/', { params: { include_inactive: true } }).then((r) => setTypes(r.data))

  useEffect(() => { load() }, [])
console.log(types)
  const openForm = (t) => { 
    setEditing(t); 
    setName(t.name || ''),
    setCapacityTons(toTons(t.capacity_kg))
  }

  async function save() {
    setSaving(true)
    
    try {
      const body = { name, capacity_kg: toKg(capacityTons)}

      if (editing.id) await api.patch(`/vehicle-types/${editing.id}`, body)
      else await api.post('/vehicle-types/', body)
      
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
                <td>{t.capacity_kg ? `${Number(t.capacity_kg) / 1000} t` : 'sin capacidad'}</td>
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
          <div className='edit-form'>
            <label className="edit-field">Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
            </label>

            <label className="edit-field">Capacidad (toneladas)
              <input
                type="number" min="0.1" step="0.1"
                value={capacityTons}
                onChange={(e) => setCapacityTons(e.target.value)}
                />
            </label>
          </div>

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