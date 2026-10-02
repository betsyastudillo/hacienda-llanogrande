import './StatusIconBadge.css'

export default function StatusIconBadge({ icon: Icon, bgColor, textColor, title }) {
  return (
    <span
      className="status-icon-badge"
      style={{ backgroundColor: bgColor, color: textColor }}
      title={title}
    >
      {Icon && <Icon size={14} />}
    </span>
  )
}