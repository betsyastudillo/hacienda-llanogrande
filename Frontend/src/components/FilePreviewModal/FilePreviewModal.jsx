import { useEffect, useState } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'
import api, { API_BASE_URL } from '../../services/api'
import './FilePreviewModal.css'

// Solo se previsualiza lo que está en esta lista. SVG y HTML quedan fuera a propósito:
// dentro de un iframe podrían ejecutar scripts.
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

const extOf = (name = '') => {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

const kindFromExt = (ext) => (ext === '.pdf' ? 'pdf' : IMAGE_EXT.includes(ext) ? 'image' : 'other')

const kindFromMime = (mime = '') =>
  mime === 'application/pdf' ? 'pdf'
    : mime.startsWith('image/') && !mime.includes('svg') ? 'image'
    : 'other'

export default function FilePreviewModal({ title, fileUrl, apiPath, filename, onClose }) {
  const [src, setSrc] = useState(null)
  const [kind, setKind] = useState('other')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl = null
    let cancelled = false

    async function load() {
      try {
        if (apiPath) {
          const res = await api.get(apiPath, { responseType: 'blob' })
          if (cancelled) return
          objectUrl = URL.createObjectURL(res.data)
          setKind(kindFromMime(res.data.type))
          setSrc(objectUrl)
        } else {
          setKind(kindFromExt(extOf(fileUrl)))
          setSrc(`${API_BASE_URL}${fileUrl}`)
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar el archivo.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [apiPath, fileUrl])

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const downloadName = filename || (fileUrl || '').split('/').pop() || 'archivo'

  return (
    <div className="fp-overlay" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="fp-header">
          <p className="fp-title">{title}</p>
          <div className="fp-actions">
            {src && (
              <>
                <a className="fp-btn" href={src} target="_blank" rel="noreferrer" title="Abrir en pestaña nueva">
                  <ExternalLink size={16} />
                </a>
                <a className="fp-btn" href={src} download={downloadName} title="Descargar">
                  <Download size={16} />
                </a>
              </>
            )}
            <button type="button" className="fp-btn" onClick={onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="fp-body">
          {loading && <p className="fp-msg">Cargando...</p>}
          {error && <p className="fp-msg">{error}</p>}
          {!loading && !error && kind === 'pdf' && <iframe className="fp-frame" src={src} title={title} />}
          {!loading && !error && kind === 'image' && <img className="fp-image" src={src} alt={title} />}
          {!loading && !error && kind === 'other' && (
            <p className="fp-msg">Este tipo de archivo no se puede previsualizar. Ábrelo o descárgalo con los botones de arriba.</p>
          )}
        </div>
      </div>
    </div>
  )
}