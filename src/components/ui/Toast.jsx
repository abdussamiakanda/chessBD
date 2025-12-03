import { useToastStore } from '../../store/toast-store'
import { useEffect } from 'react'
import './Toast.css'

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.type === 'error' ? 5000 : 3000)
    return () => clearTimeout(timer)
  }, [onClose, toast.type])

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
    >
      <div className="toast-content">
        <div className="toast-message">
          {typeof toast.message === 'string' ? (
            <p className="toast-text">{toast.message}</p>
          ) : (
            <div className="toast-text">{toast.message}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="toast-close"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}


