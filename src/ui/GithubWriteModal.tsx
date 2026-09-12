import { Modal } from './Modal'
import { Icon } from './components'
import { useStore } from '../lib/store'
import { useUI } from './context'

export function GithubWriteModal({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const { config, session } = useStore()
  const { openSignIn } = useUI()

  return (
    <Modal
      title={title || 'Опубликовать через GitHub'}
      subtitle={`Прямая отправка доступна участникам репозитория ${config.owner}/${config.repo}.`}
      onClose={onClose}
      footer={
        <div className="row row--gap row--end">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          {!session.user ? (
            <button type="button" className="btn btn--ghost" onClick={() => { onClose(); openSignIn() }}>
              Войти в аккаунт
            </button>
          ) : null}
          <a className="btn btn--primary" href={url} target="_blank" rel="noopener noreferrer">
            <Icon name="github" size={16} /> Открыть форму на GitHub
          </a>
        </div>
      }
    >
      <p>
        Текст поста мы уже подготовили — он подставится в форму на GitHub. После отправки тема появится на форуме
        автоматически (обновите страницу через пару секунд).
      </p>
      <div className="notice">
        Так работает любой статический форум на GitHub Pages: чтение открыто всем, запись — через аккаунт GitHub.
      </div>
      <p className="muted small">Ссылка для ручной публикации:</p>
      <code className="code-block">{url}</code>
    </Modal>
  )
}
