import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  icon,
  width = 560,
  children,
  footer
}: {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title: string
  description?: string
  icon?: ReactNode
  width?: number
  children: ReactNode
  footer?: ReactNode
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card" style={{ width }}>
        <div className="modal-head">
          <div className="modal-head-copy">
            {icon && <span className="modal-icon">{icon}</span>}
            <div>
              {eyebrow && <div className="modal-eyebrow">{eyebrow}</div>}
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
