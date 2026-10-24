import { AlertTriangle, X } from 'lucide-react'
import { Spinner } from './Ui'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  danger = false,
  busy = false,
  onConfirm,
  onClose
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}): JSX.Element | null {
  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="confirm-dialog">
        <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
          <AlertTriangle size={21} />
        </div>
        <button type="button" className="modal-close" onClick={onClose} disabled={busy}>
          <X size={17} />
        </button>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
