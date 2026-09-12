import { useUI } from './context'
import { Icon } from './components'

export function Toaster() {
  const { toasts, dismissToast } = useUI()
  if (!toasts.length) return null
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span className="toast__text">{t.text}</span>
          <button type="button" className="toast__close" onClick={() => dismissToast(t.id)} aria-label="Скрыть">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
