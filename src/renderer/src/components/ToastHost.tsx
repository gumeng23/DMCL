import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useApp } from '@renderer/state/AppContext'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}

export function ToastHost(): JSX.Element {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="toast-host">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type]
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              <Icon size={17} />
            </span>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="关闭提示">
              <X size={14} />
            </button>
            <span className="toast-timer" />
          </div>
        )
      })}
    </div>
  )
}
