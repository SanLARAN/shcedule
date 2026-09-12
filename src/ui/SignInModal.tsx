import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { Icon, Spinner } from './components'
import { useStore } from '../lib/store'
import { useUI } from './context'
import * as gh from '../lib/github'

type Phase = 'idle' | 'waiting' | 'error' | 'success'

export function SignInModal({ onClose }: { onClose: () => void }) {
  const { config, signInWithToken, signOut, session, switchToDemo } = useStore()
  const { toast } = useUI()

  const [tab, setTab] = useState<'github' | 'token'>('github')
  const [phase, setPhase] = useState<Phase>('idle')
  const [device, setDevice] = useState<gh.DeviceCodeResponse | null>(null)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [pat, setPat] = useState('')
  const [patBusy, setPatBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)

  const intervalRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const cancelled = useRef(false)

  const stopTimers = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    if (tickRef.current) window.clearInterval(tickRef.current)
    intervalRef.current = null
    tickRef.current = null
  }

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
      stopTimers()
    }
  }, [])

  const hasClientId = Boolean(config.clientId.trim())

  async function startDeviceFlow() {
    setError('')
    setPhase('idle')
    try {
      const res = await gh.startDeviceFlow(config.clientId.trim())
      setDevice(res.data)
      setPhase('waiting')
      setSecondsLeft(res.data.expires_in)
      // Код удобно сразу скопировать: на GitHub его надо будет вставить.
      try {
        await navigator.clipboard.writeText(res.data.user_code)
        setCopied(true)
      } catch {
        setCopied(false)
      }
      // Открываем вкладку сразу по клику (иначе часть браузеров блокирует popup).
      const opened = window.open(res.data.verification_uri, '_blank', 'noopener')
      if (!opened) setPopupBlocked(true)

      tickRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            stopTimers()
            setPhase('error')
            setError('Код истёк. Начните вход заново.')
            return 0
          }
          return s - 1
        })
      }, 1000)

      let interval = Math.max(5, res.data.interval || 5)
      const poll = async () => {
        if (cancelled.current) return
        const result = await gh.pollDeviceToken(config.clientId.trim(), res.data.device_code)
        if (cancelled.current) return
        if (result.status === 'ok') {
          stopTimers()
          const ok = await signInWithToken(result.token)
          if (cancelled.current) return
          if (ok.ok) {
            setPhase('success')
            toast('Вы вошли в аккаунт GitHub', 'success')
            window.setTimeout(() => !cancelled.current && onClose(), 700)
          } else {
            setPhase('error')
            setError(ok.message || 'Не удалось войти')
          }
        } else if (result.status === 'slow_down') {
          interval = Math.max(interval + 5, result.interval)
          restartPolling(interval, poll)
        } else if (result.status === 'error') {
          stopTimers()
          setPhase('error')
          setError(result.message)
        }
      }

      const restartPolling = (every: number, fn: () => void) => {
        if (intervalRef.current) window.clearInterval(intervalRef.current)
        intervalRef.current = window.setInterval(fn, every * 1000)
      }

      restartPolling(interval, poll)
      window.setTimeout(poll, 1200)
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Не удалось начать вход')
    }
  }

  async function submitPat(e: React.FormEvent) {
    e.preventDefault()
    setPatBusy(true)
    setError('')
    const result = await signInWithToken(pat)
    setPatBusy(false)
    if (result.ok) {
      toast('Токен принят — вы вошли', 'success')
      onClose()
    } else {
      setPhase('error')
      setError(result.message || 'Токен не подошёл')
    }
  }

  const newTokenUrl = `https://github.com/settings/tokens/new?scopes=public_repo&description=${encodeURIComponent(
    `Форум ${config.owner}/${config.repo}`,
  )}`

  return (
    <Modal
      title={session.user ? `Вы вошли как ${session.user.login}` : 'Вход'}
      subtitle={
        session.user
          ? 'Аккаунт GitHub используется для публикации постов и ответов.'
          : 'Вход через GitHub — пароль остаётся на github.com, сайт его не видит.'
      }
      onClose={onClose}
    >
      {session.user ? (
        <div className="signin-account">
          <img className="avatar" src={session.user.avatar_url} alt="" width={52} height={52} />
          <div>
            <strong>{session.user.name || session.user.login}</strong>
            <div className="muted">@{session.user.login}</div>
            <div className="muted small">
              {session.canWrite
                ? 'Есть права на публикацию в этом репозитории.'
                : 'Права на публикацию отсутствуют — посты можно отправить через форму GitHub.'}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="tabs tabs--inline" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'github'}
              className={tab === 'github' ? 'tab is-active' : 'tab'}
              onClick={() => setTab('github')}
            >
              <Icon name="github" size={16} /> Через GitHub
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'token'}
              className={tab === 'token' ? 'tab is-active' : 'tab'}
              onClick={() => setTab('token')}
            >
              По токену
            </button>
          </div>

          {tab === 'github' ? (
            <div className="signin-panel">
              {!hasClientId ? (
                <div className="notice notice--warn">
                  <strong>Владельцу форума:</strong> чтобы включить вход одной кнопкой, создайте{' '}
                  <a href="https://github.com/settings/applications/new" target="_blank" rel="noopener noreferrer">
                    OAuth App
                  </a>{' '}
                  с включённым <em>Device Flow</em> и впишите её <code>client_id</code> в «Настройках» форума. А пока
                  используйте вход по токену.
                </div>
              ) : null}

              {phase === 'idle' || phase === 'error' ? (
                <>
                  {error ? <div className="notice notice--error">{error}</div> : null}
                  <p className="muted">
                    Мы покажем короткий код, вы подтвердите его на github.com — и вернётесь сюда уже авторизованным.
                  </p>
                  <button type="button" className="btn btn--primary btn--block" onClick={startDeviceFlow} disabled={!hasClientId}>
                    <Icon name="github" size={16} /> Получить код
                  </button>
                  {!hasClientId ? <p className="muted small">Вход по коду недоступен без client_id.</p> : null}
                </>
              ) : null}

              {phase === 'waiting' && device ? (
                <div className="device">
                  <ol className="device__steps">
                    <li>
                      <b>Код скопирован</b> — нажмите «Открыть GitHub» и вставьте его на странице
                      подтверждения (или введите вручную).
                    </li>
                    <li>Нажмите «Authorize» и вернитесь сюда — вход произойдёт сам.</li>
                  </ol>

                  <button
                    type="button"
                    className="device__code"
                    title="Скопировать код"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(device.user_code)
                        setCopied(true)
                        toast('Код скопирован')
                      } catch {
                        setCopied(false)
                      }
                    }}
                  >
                    <span>{device.user_code}</span>
                    <small>
                      <Icon name={copied ? 'check' : 'copy'} size={14} />
                      {copied ? 'скопировано — нажмите, чтобы скопировать снова' : 'нажмите, чтобы скопировать'}
                    </small>
                  </button>

                  {popupBlocked ? (
                    <div className="notice notice--warn small">
                      Браузер заблокировал новую вкладку — откройте{' '}
                      <a href={device.verification_uri} target="_blank" rel="noopener noreferrer">
                        {device.verification_uri}
                      </a>{' '}
                      вручную.
                    </div>
                  ) : null}

                  <div className="device__status">
                    <Spinner size={16} label={`Ждём подтверждения… код действует ещё ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`} />
                  </div>

                  <div className="row row--gap">
                    <a className="btn btn--primary" href={device.verification_uri} target="_blank" rel="noopener noreferrer">
                      Открыть GitHub <Icon name="external" size={15} />
                    </a>
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(device.user_code)
                          toast('Код скопирован')
                        } catch {
                          /*ignore*/
                        }
                      }}
                    >
                      <Icon name="copy" size={15} /> Скопировать код
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => { stopTimers(); setPhase('idle') }}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : null}

              {phase === 'success' ? (
                <div className="notice notice--ok">
                  <Icon name="check" size={16} /> Готово! Входим…
                </div>
              ) : null}
            </div>
          ) : (
            <form className="signin-panel" onSubmit={submitPat}>
              {error ? <div className="notice notice--error">{error}</div> : null}
              <p className="muted">
                Токен создаётся на github.com и хранится только в этом браузере (localStorage). Запросите scope{' '}
                <code>public_repo</code>, чтобы постить от своего имени.
              </p>
              <input
                className="input"
                type="password"
                placeholder="ghp_..."
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="row row--gap">
                <button type="submit" className="btn btn--primary" disabled={!pat.trim() || patBusy}>
                  {patBusy ? <Spinner size={15} /> : <Icon name="check" size={16} />} Войти
                </button>
                <a className="btn btn--ghost" href={newTokenUrl} target="_blank" rel="noopener noreferrer">
                  Создать токен <Icon name="external" size={15} />
                </a>
              </div>
              <p className="muted xsmall">
                Совет: можно выдать «fine-grained token» с доступом только к репозиторию {config.owner}/{config.repo} и
                правом Issues: Read and write. Это безопаснее.
              </p>
            </form>
          )}
        </>
      )}

      <div className="modal__aside">
        {session.user ? (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => { signOut(); toast('Вы вышли из аккаунта'); onClose() }}>
            <Icon name="logout" size={16} /> Выйти из аккаунта
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              switchToDemo()
              toast('Включён демо-режим: посты сохраняются в браузере')
              onClose()
            }}
          >
            Посмотреть без аккаунта (демо)
          </button>
        )}
      </div>
    </Modal>
  )
}
