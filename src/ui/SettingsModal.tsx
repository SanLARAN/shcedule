import { useState } from 'react'
import { Modal } from './Modal'
import { Icon, Spinner } from './components'
import { useStore } from '../lib/store'
import { useUI } from './context'
import { demoReset } from '../lib/demo'
import * as gh from '../lib/github'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { config, updateConfig, session, repoInfo, repoError, isDemo, switchToDemo, switchToGithub } = useStore()
  const { toast } = useUI()

  const [title, setTitle] = useState(config.title)
  const [tagline, setTagline] = useState(config.tagline)
  const [owner, setOwner] = useState(config.owner)
  const [repo, setRepo] = useState(config.repo)
  const [clientId, setClientId] = useState(config.clientId)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const dirty =
    title !== config.title || tagline !== config.tagline || owner !== config.owner || repo !== config.repo || clientId !== config.clientId

  function save() {
    updateConfig({ title: title.trim() || 'Форум', tagline, owner: owner.trim(), repo: repo.trim(), clientId: clientId.trim() })
    toast('Настройки сохранены в этом браузере', 'success')
    onClose()
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await gh.getRepo(owner.trim(), repo.trim(), session.token)
      setTestResult(
        `OK · ${res.data.full_name} · issue ${res.data.has_issues ? 'включены' : 'ВЫКЛЮЧЕНЫ'} · открытых тем: ${res.data.open_issues_count}`,
      )
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setTesting(false)
    }
  }

  function clearCache() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('forum:cache:'))
        .forEach((k) => localStorage.removeItem(k))
      toast('Кеш очищен — данные перечитаются с GitHub', 'success')
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal
      title="Настройки форума"
      subtitle="Хранятся в localStorage этого браузера — удобно для локальной проверки."
      onClose={onClose}
      wide
      footer={
        <div className="row row--gap row--end">
          <button type="button" className="btn" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty}>
            Сохранить
          </button>
        </div>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Название форума</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Форум" />
        </label>
        <label className="field">
          <span className="field__label">Подпись</span>
          <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Обсуждаем вместе" />
        </label>
        <label className="field">
          <span className="field__label">Владелец репозитория</span>
          <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="username" spellCheck={false} />
        </label>
        <label className="field">
          <span className="field__label">Репозиторий</span>
          <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="repo" spellCheck={false} />
        </label>
        <label className="field field--full">
          <span className="field__label">GitHub OAuth client_id (для входа по коду)</span>
          <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Ov23li…" spellCheck={false} />
          <span className="field__hint">
            Создайте OAuth App: <code>Settings → Developer settings → OAuth Apps</code>, включите <b>Device Flow</b>, а сюда
            вставьте её client_id. Секрет не нужен — он остаётся на GitHub.
          </span>
        </label>
      </div>

      <div className="settings-block">
        <div className="settings-block__head">
          <h3>Источник данных</h3>
        </div>
        <div className="segmented">
          <button type="button" className={!isDemo ? 'segmented__item is-active' : 'segmented__item'} onClick={switchToGithub}>
            GitHub Issues
          </button>
          <button type="button" className={isDemo ? 'segmented__item is-active' : 'segmented__item'} onClick={switchToDemo}>
            Демо-режим (локально)
          </button>
        </div>
        <p className="muted small">
          {isDemo
            ? 'Посты и комментарии лежат в этом браузере и никуда не отправляются. Удобно для примерки дизайна.'
            : `Темы форума читаются из issues репозитория ${config.owner}/${config.repo}.`}
        </p>
        <div className="row row--gap">
          <button type="button" className="btn btn--sm" onClick={test} disabled={testing}>
            {testing ? <Spinner size={15} /> : <Icon name="check" size={15} />} Проверить соединение
          </button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={clearCache}>
            Очистить кеш
          </button>
          {isDemo ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                demoReset()
                toast('Демо-данные пересозданы', 'success')
              }}
            >
              Сбросить демо-данные
            </button>
          ) : null}
        </div>
        {testResult ? <div className="notice small">{testResult}</div> : null}
        {repoError && !isDemo ? <div className="notice notice--error small">{repoError}</div> : null}
      </div>

      <div className="settings-block">
        <h3>Состояние</h3>
        <ul className="kv">
          <li>
            <span>Аккаунт</span>
            <b>{session.user ? `@${session.user.login}` : 'не выполнен вход'}</b>
          </li>
          <li>
            <span>Права на запись</span>
            <b>{session.canWrite ? 'есть' : 'нет'}</b>
          </li>
          <li>
            <span>Репозиторий</span>
            <b>{repoInfo ? `${repoInfo.full_name}${repoInfo.has_issues ? '' : ' (issues выключены!)'}` : '—'}</b>
          </li>
        </ul>
        <p className="muted xsmall">
          Подсказка: Issues должны быть включены в репозитории (Settings → Features → Issues), иначе создавать темы не
          получится.
        </p>
      </div>
    </Modal>
  )
}
