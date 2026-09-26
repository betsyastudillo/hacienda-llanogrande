import './StatusBadge.css'

export default function StatusBadge({label, bgColor, textoColor, icon: Icon }) {
  return (
    <span
      className='status-badge'
      style={{backgroundColor: bgColor, color: textoColor }}
    >
      {Icon && <Icon size={16} style={{marginRight: 4, verticalAlign: -2 }} />}
      {label}
    </span>
    )
}