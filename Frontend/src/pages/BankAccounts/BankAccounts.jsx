import { useEffect, useState } from 'react'
import { CirclePlus, Pencil, Power } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal/Modal'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { BANKS, OTHER_BANK, ACCOUNT_TYPES, HOLDER_DOCUMENT_TYPES } from '../../constants/banks'
import './BankAccounts.css'
import { formatAccountNumber } from '../../utils/formatAccountNumber'

const EMPTY_FORM = {
  bank: '',
  custom_bank: '',
  account_type: 'ahorros',
  account_number: '',
  account_holder_name: '',
  account_holder_document_type: 'NIT',
  account_holder_document_number: '',
  agreement_number: '',
}

export default function BankAccounts() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('bank_account:gestionar')

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirm, setConfirm] = useState(null) // { type: 'deactivate' | 'reactivate', account }
  const [processing, setProcessing] = useState(false)

  const loadAccounts = async () => {
    try {
      const res = await api.get('/bank-accounts/')
      setAccounts(res.data)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar las cuentas'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  // El número de cuenta solo admite dígitos, también si lo pegan con espacios o guiones
  const handleDigits = (field) => (e) =>
    setForm({ ...form, [field]: e.target.value.replace(/\D/g, '') })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (account) => {

    const known = BANKS.includes(account.bank_name)
    setEditingId(account.id)
    setForm({
      bank: known ? account.bank_name : OTHER_BANK,
      custom_bank: known ? '' : account.bank_name,
      account_type: account.account_type,
      account_number: account.account_number,
      account_holder_name: account.account_holder_name,
      account_holder_document_type: account.account_holder_document_type,
      account_holder_document_number: account.account_holder_document_number,
      agreement_number: account.agreement_number || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormError('')
  }

  const handleSave = async () => {
    setFormError('')

    const bankName = form.bank === OTHER_BANK ? form.custom_bank.trim() : form.bank

    if (!bankName) {
      setFormError('Selecciona el banco')
      return
    }
    if (!/^\d{6,20}$/.test(form.account_number)) {
      setFormError('El número de cuenta debe tener solo números (entre 6 y 20 dígitos)')
      return
    }
    if (!form.account_holder_name.trim() || !form.account_holder_document_number.trim()) {
      setFormError('Completa los datos del titular')
      return
    }

    const payload = {
      bank_name: bankName,
      account_type: form.account_type,
      account_number: form.account_number,
      account_holder_name: form.account_holder_name.trim(),
      account_holder_document_type: form.account_holder_document_type,
      account_holder_document_number: form.account_holder_document_number.trim(),
      agreement_number: form.agreement_number.trim() || null,
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/bank-accounts/${editingId}`, payload)
      } else {
        const r = await api.post('/bank-accounts/', payload)
        console.log('resp', r)
      }
      closeModal()
      await loadAccounts()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la cuenta'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    setProcessing(true)
    try {
      if (confirm.type === 'deactivate') {
        await api.delete(`/bank-accounts/${confirm.account.id}`)
      } else {
        await api.patch(`/bank-accounts/${confirm.account.id}/reactivate`)
      }
      setConfirm(null)
      await loadAccounts()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo completar la acción'))
      setConfirm(null)
    } finally {
      setProcessing(false)
    }
  }

  const typeLabel = (value) => ACCOUNT_TYPES.find((t) => t.value === value)?.label || value

  return (
    <main className="bank-main">
      <div className="bank-header">
        <h1 className="bank-title">Cuentas bancarias</h1>
        {canManage && (
          <button type="button" className="bank-create-btn" onClick={openCreate}>
            <CirclePlus size={18} />
            Crear
          </button>
        )}
      </div>

      {error && <div className="bank-error">{error}</div>}
      {loading && <p className="bank-empty">Cargando cuentas...</p>}

      {!loading && accounts.length === 0 && (
        <p className="bank-empty">Todavía no hay cuentas registradas.</p>
      )}

      {!loading && accounts.length > 0 && (
        <div className="bank-table-wrapper">
          <table className="bank-table">
            <thead>
              <tr>
                <th>Banco</th>
                <th>Tipo Cuenta</th>
                <th>Número</th>
                <th>Convenio</th>
                <th>Titular</th>
                <th>Estado</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className={!account.is_active ? 'bank-row-inactive' : ''}>
                  <td>{account.bank_name}</td>
                  <td>{typeLabel(account.account_type)}</td>
                  <td className='bank-number-account-cell'>{formatAccountNumber(account.account_number)}</td>
                  <td>{account.agreement_number || '-' }</td>
                  <td className="bank-holder-cell" title={account.account_holder_name}>
                    {account.account_holder_name}
                    <span className="bank-holder-doc">
                      {account.account_holder_document_type} {account.account_holder_document_number}
                    </span>
                  </td>
                  <td>
                    {account.is_active ? (
                      <StatusBadge label="Activa" bgColor="#D9F0DC" textColor="#1F5C29" />
                    ) : (
                      <StatusBadge label="Inactiva" bgColor="#E5E3DB" textColor="#5F5E5A" />
                    )}
                  </td>
                  {canManage && (
                    <td>
                      <div className="bank-actions">
                        <button type="button" className="bank-icon-btn" title="Editar" onClick={() => openEdit(account)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="bank-icon-btn"
                          title={account.is_active ? 'Desactivar' : 'Reactivar'}
                          onClick={() => setConfirm({ type: account.is_active ? 'deactivate' : 'reactivate', account })}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editingId ? 'Editar cuenta bancaria' : 'Nueva cuenta bancaria'} onClose={closeModal}>
          {formError && <div className="bank-form-error">{formError}</div>}

          <div className="bank-form-field">
            <label className="bank-form-label">Banco</label>
            <select className="bank-form-input" value={form.bank} onChange={handleChange('bank')}>
              <option value="">Selecciona un banco</option>
              {BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
              <option value={OTHER_BANK}>Otro</option>
            </select>
          </div>

          {form.bank === OTHER_BANK && (
            <div className="bank-form-field">
              <input
                className="bank-form-input"
                placeholder="Nombre del banco"
                value={form.custom_bank}
                onChange={handleChange('custom_bank')}
              />
            </div>
          )}

          <div className="bank-form-row">
            <div className="bank-form-field">
              <label className="bank-form-label">Tipo de cuenta</label>
              <select className="bank-form-input" value={form.account_type} onChange={handleChange('account_type')}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="bank-form-field">
              <label className="bank-form-label">Número de cuenta</label>
              <input
                className="bank-form-input"
                inputMode="numeric"
                maxLength={20}
                value={form.account_number}
                onChange={handleDigits('account_number')}
              />
            </div>
          </div>

          <div className="bank-form-field">
            <label className="bank-form-label">Nombre del titular</label>
            <input
              className="bank-form-input"
              value={form.account_holder_name}
              onChange={handleChange('account_holder_name')}
            />
          </div>

          <div className="bank-form-row">
            <div className="bank-form-field">
              <label className="bank-form-label">Documento del titular</label>
              <select
                className="bank-form-input"
                value={form.account_holder_document_type}
                onChange={handleChange('account_holder_document_type')}
              >
                {HOLDER_DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="bank-form-field">
              <label className="bank-form-label">Número</label>
              <input
                className="bank-form-input"
                value={form.account_holder_document_number}
                onChange={handleChange('account_holder_document_number')}
              />
            </div>
          </div>

          <div className="bank-form-field">
            <label className="bank-form-label">Número de convenio (opcional)</label>
            <input
              className="bank-form-input"
              value={form.agreement_number}
              onChange={handleChange('agreement_number')}
            />
          </div>

          <button type="button" className="bank-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.type === 'deactivate' ? 'Desactivar cuenta' : 'Reactivar cuenta'}
          confirmLabel='Confirmar'
          tone={confirm.type === 'deactivate' ? 'danger' : 'primary'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={processing}
        >
          {confirm.type === 'deactivate' ? (
            <>
              ¿Desactivar la cuenta <strong>{confirm.account.bank_name} {confirm.account.account_number}</strong>?
              Los clientes dejarán de verla al pagar. Las proformas ya creadas con esta cuenta no cambian.
            </>
          ) : (
            <>
              ¿Reactivar la cuenta <strong>{confirm.account.bank_name} {confirm.account.account_number}</strong>?
              Los clientes volverán a poder elegirla al pagar.
            </>
          )}
        </ConfirmModal>
      )}
    </main>
  )
}