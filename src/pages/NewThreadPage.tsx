import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../config'
import { useStore } from '../lib/store'
import { Markdown } from '../ui/components'
import { Icon, Spinner } from '../ui/components'
import { useUI } from '../ui/context'
import { classNames } from '../lib/format'

const DRAFT_KEY = 'forum:draft'

type Draft = { title: string; body: string; category: string; tags: string }

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function NewThreadPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { createThread, config, isDemo, session } = useStore()
  const { openSignIn, openGithubWrite, toast } = useUI()

  const initial = readDraft()
  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [category, setCategory] = useState(params.get('c') || initial?.category || 'general')
  const [tags, setTags] = useState(initial?.tags || '')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [sending, setSending] = useState(false)
  const [restored, setRestored] = useState(Boolean(initial?.title || initial?.body))

  // Черновик сохраняем автоматически — потерять пост при закрытии вкладки нельзя.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (title || body) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, category, tags }))
        else localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [title, body, category, tags])

  const parsedTags = useMemo(
    () =>
      tags
        .split(/[,\s]+/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 6),
    [tags],
  )

  const canSubmit = title.trim().length >= 4 && body.trim().length >= 10 && !sending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    const res = await createThread({ title: title.trim(), body: body.trim(), category, tags: parsedTags })
    setSending(false)

    if (res.status === 'ok') {
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      toast('Тема опубликована', 'success')
      if (res.number && !isDemo) navigate(`/t/${res.number}`)
      else navigate('/')
      return
    }
    if (res.status === 'needs-auth') {
      openSignIn()
      toast('Сначала войдите через GitHub', 'info')
      return
    }
    if (res.status === 'needs-github') {
      openGithubWrite(res.url, 'Опубликовать тему')
      return
    }
    toast(res.message, 'error')
  }

  return (
    <div className="compose">
      <nav className="crumbs">
        <Link to="/" className="crumbs__link">
          <Icon name="arrow-left" size={16} /> Все темы
        </Link>
      </nav>

      <h1 className="page-title">Новая тема</h1>
      <p className="page-subtitle">
        {isDemo
          ? 'Демо-режим: тема сохранится в этом браузере.'
          : session.canWrite
            ? `Тема будет создана в ${config.owner}/${config.repo} и сразу появится на форуме.`
            : 'Тема будет опубликована через GitHub — после отправки формы она появится на форуме.'}
      </p>

      {restored ? (
        <div className="notice small">
          Мы восстановили черновик из этого браузера.{' '}
          <button
            type="button"
            className="btn btn--xs btn--ghost"
            onClick={() => {
              setTitle('')
              setBody('')
              setTags('')
              setRestored(false)
            }}
          >
            Начать заново
          </button>
        </div>
      ) : null}

      <form className="compose__grid" onSubmit={submit}>
        <div className="compose__main">
          <label className="field">
            <span className="field__label">Заголовок</span>
            <input
              className="input input--lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="О чём тема? Сформулируйте коротко и ясно"
              maxLength={180}
              required
            />
            <span className="field__hint">{title.trim().length}/180</span>
          </label>

          <div className="editor">
            <div className="tabs tabs--inline">
              <button type="button" className={classNames('tab', tab === 'write' && 'is-active')} onClick={() => setTab('write')}>
                Написать
              </button>
              <button type="button" className={classNames('tab', tab === 'preview' && 'is-active')} onClick={() => setTab('preview')}>
                Предпросмотр
              </button>
            </div>
            {tab === 'preview' ? (
              <div className="editor__preview">
                {title ? <h2 className="preview-title">{title}</h2> : null}
                {body.trim() ? <Markdown source={body} /> : <p className="muted">Пока пусто — напишите что-нибудь в редакторе.</p>}
              </div>
            ) : (
              <textarea
                className="textarea textarea--tall"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={'Расскажите подробнее.\n\nMarkdown приветствуется: **жирный**, *курсив*, `код`, списки, ссылки и картинки.'}
              />
            )}
          </div>

          <div className="compose__actions">
            <span className="muted xsmall">Черновик сохраняется автоматически в этом браузере.</span>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
              {sending ? <Spinner size={15} /> : <Icon name="check" size={16} />} Опубликовать
            </button>
          </div>
        </div>

        <aside className="compose__aside">
          <section className="panel">
            <h2 className="panel__title">Раздел</h2>
            <div className="cat-picker">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={classNames('cat-pick', category === c.id && 'is-active')}
                  onClick={() => setCategory(c.id)}
                  style={category === c.id ? { borderColor: c.color, color: c.color } : undefined}
                >
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
            <p className="muted small">{CATEGORIES.find((c) => c.id === category)?.description}</p>
          </section>

          <section className="panel">
            <h2 className="panel__title">Теги</h2>
            <input
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="через запятую: помощь, дизайн"
            />
            {parsedTags.length ? (
              <div className="chips chips--tight">
                {parsedTags.map((t) => (
                  <span key={t} className="chip chip--static">
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel panel--muted">
            <h2 className="panel__title">Шпаргалка Markdown</h2>
            <ul className="tips">
              <li><code>**жирный**</code> — выделить главное</li>
              <li><code>- пункт</code> — список</li>
              <li><code>`код`</code> и <code>```блок```</code></li>
              <li><code>[ссылка](https://…)</code></li>
              <li><code>![подпись](https://…png)</code> — картинка</li>
              <li><code>&gt; цитата</code></li>
            </ul>
          </section>
        </aside>
      </form>
    </div>
  )
}
