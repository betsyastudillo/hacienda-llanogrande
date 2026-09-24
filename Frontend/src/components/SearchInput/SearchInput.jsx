import { Search } from 'lucide-react'
import './SearchInput.css'

export default function SearchInput({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="search-input-wrapper">
      <Search size={16} className="search-input-icon" />
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}