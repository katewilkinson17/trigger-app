import { useEffect } from 'react'

export default function PhotoViewer({ url, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="photo-viewer-overlay" onClick={onClose}>
      <button
        className="photo-viewer-close"
        onClick={onClose}
        aria-label="Close photo"
      >
        ✕
      </button>
      <img
        src={url}
        alt="Attached bill"
        className="photo-viewer-img"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
