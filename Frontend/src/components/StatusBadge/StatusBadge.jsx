import { STATUS_LABELS, STATUS_COLORS, STATUS_ICONS } from '../../constants/orderStatus'
import './StatusBadge.css'

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || { bg: '#ece9e2', text: '#5f5e5a' }
  const Icon = STATUS_ICONS[status]

  return (
    <span
      className="status-badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {Icon && <Icon size={16} style={{ marginRight: 4, verticalAlign: -2 }} />}
      {STATUS_LABELS[status] || status}
    </span>
  )
}