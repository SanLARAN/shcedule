import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { Thread, ThreadComment } from '../lib/model'
import { getCategory } from '../config'
import { Avatar, Badge, CopyButton, EmptyState, Icon, LikeButton, Markdown, SkeletonCard, Spinner, Time } from '../ui/components'
import { useUI } from '../ui/context'
import { classNames, plural } from '../lib/format'

export function ThreadPage() {
  const { number } = useParams()
  const postNumber = Number(number)
  const { loadThread, addComment, toggleLike, isDemo, session, config } = useStore()
  const { openSignIn, openGithubWrite, toast } = useUI()

  const [thread, setThread] = useState<Thread | null>(null)
  const [comments, setComments] = useState<ThreadComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [preview, setPreview] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(postNumber)) {
      setError('Некорректный номер темы')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadThread(postNumber)
      if (!data) {
        setError('Тема не найдена — возможно, она удалена или ещё не проиндексирована GitHub.')
      } else {
        setThread(data.thread)
        setComments(data.comments)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить тему')
    } finally {
      setLoading(false)
    }
  }, [loadThread, postNumber])

  useEffect(() => {
    void load()
  }, [load])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    if (!session.user && !isDemo) {
      openSignIn()
      return
    }
    setSending(true)
    const res = await addComment(postNumber, text)
    setSending(false)
    if (res.status === 'ok') {
      setDraft('')
      setPreview(false)
      toast('Ответ опубликован', 'success')
      await load()
    } else if (res.status === 'needs-auth') {
      openSignIn()
    } else if (res.status === 'needs-github') {
      openGithubWrite(res.url, 'Ответить через GitHub')
    } else {
      toast(res.message, 'error')
    }
  }

  async function handleLike() {
    if (!thread) return
    const liked = !thread.likedByMe
    const res = await toggleLike(thread.number, liked)
    if (res.status === 'ok') {
      setThread({ ...thread, likedByMe: liked, likes: Math.max(0, thread.likes + (liked ? 1 : -1)) })
    } else if (res.status === 'needs-auth') {
      openSignIn()
    } else if (res.status === 'needs-github') {
      openGithubWrite(res.url, 'Реакция через GitHub')
    } else {
      toast(res.message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="thread-page">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error || !thread) {
    return (
      <div className="thread-page">
        <EmptyState
          emoji="🔍"
          title="Тема не найдена"
          text={error || 'Возможно, ссылка устарела.'}
          action={
            <div className="row row--gap">
              <Link className="btn btn--primary" to="/">
                К списку тем
              </Link>
              <button type="button" className="btn" onClick={() => void load()}>
                Попробовать снова
              </button>
            </div>
          }
        />
      </div>
    )
  }

  const cat = getCategory(thread.category)
  const shareUrl = `${window.location.origin}${window.location.pathname}#/t/${thread.number}`

  return (
    <div className="thread-page">
      <nav className="crumbs">
        <Link to="/" className="crumbs__link">
          <Icon name="arrow-left" size={16} /> Все темы
        </Link>
        <span className="crumbs__sep">/</span>
        <Link to={`/c/${cat.id}`} className="crumbs__link">
          <span className="cat-link__dot" style={{ background: cat.color }} aria-hidden="true" />
          {cat.label}
        </Link>
      </nav>

      <article className="post">
        <header className="post__head">
          <h1 className="post__title">
            {thread.pinned ? <span className="pin">📌</span> : null} {thread.title}
          </h1>
          <div className="post__meta">
            <Link to={`/u/${thread.author.login}`} className="post__author">
              <Avatar author={thread.author} size={36} />
              <span>
                <b>@{thread.author.login}</b>
                <Time iso={thread.createdAt} />
              </span>
            </Link>
            <div className="post__meta-right">
              <Badge color={cat.color}>
                {cat.emoji} {cat.label}
              </Badge>
              {thread.state === 'closed' ? <Badge className="badge--muted">закрыто</Badge> : null}
              {thread.tags.map((tag) => (
                <Badge key={tag} className="badge--tag">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        </header>

        <Markdown source={thread.body} className="post__body" />

        <footer className="post__foot">
          <div className="row row--gap">
            <LikeButton likes={thread.likes} liked={thread.likedByMe} onToggle={handleLike} />
            <a className="btn btn--ghost btn--sm" href={thread.htmlUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="github" size={15} /> {isDemo ? 'Демо-режим' : 'Открыть в GitHub'}
            </a>
            {!isDemo ? <CopyButton value={shareUrl} label="Ссылка" /> : null}
          </div>
          {!isDemo ? (
            <span className="muted xsmall">
              Тема #{thread.number} в {config.owner}/{config.repo}
            </span>
          ) : null}
        </footer>
      </article>

      <section className="comments" id="comments">
        <h2 className="comments__title">
          {comments.length} {plural(comments.length, ['ответ', 'ответа', 'ответов'])}
        </h2>

        {comments.length ? (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="comment">
                <Link to={`/u/${c.author.login}`} className="comment__avatar">
                  <Avatar author={c.author} size={36} />
                </Link>
                <div className="comment__main">
                  <div className="comment__head">
                    <Link to={`/u/${c.author.login}`}>
                      <b>@{c.author.login}</b>
                    </Link>
                    <span className="dot" />
                    <span className="muted small">
                      <Time iso={c.createdAt} />
                    </span>
                  </div>
                  <Markdown source={c.body} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Ответов пока нет — будьте первым.</p>
        )}
      </section>

      <section className="reply">
        <h2 className="reply__title">Ваш ответ</h2>
        {!session.user && !isDemo ? (
          <div className="notice notice--warn">
            Чтобы отвечать, войдите через GitHub — это займёт полминуты.{' '}
            <button type="button" className="btn btn--xs btn--primary" onClick={openSignIn}>
              Войти
            </button>
          </div>
        ) : null}
        <form onSubmit={submitComment}>
          <div className="editor">
            <div className="tabs tabs--inline">
              <button type="button" className={classNames('tab', !preview && 'is-active')} onClick={() => setPreview(false)}>
                Написать
              </button>
              <button type="button" className={classNames('tab', preview && 'is-active')} onClick={() => setPreview(true)}>
                Предпросмотр
              </button>
            </div>
            {preview ? (
              <div className="editor__preview">
                {draft.trim() ? <Markdown source={draft} /> : <p className="muted">Пока нечего показывать…</p>}
              </div>
            ) : (
              <textarea
                className="textarea"
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Поддерживается Markdown: **жирный**, `код`, списки, ссылки, картинки"
              />
            )}
          </div>
          <div className="reply__actions">
            <span className="muted xsmall">
              {isDemo ? 'Демо-режим: ответ сохранится в этом браузере.' : 'Ответ появится в GitHub Issues и на форуме.'}
            </span>
            <button type="submit" className="btn btn--primary" disabled={sending || !draft.trim()}>
              {sending ? <Spinner size={15} /> : <Icon name="check" size={16} />} Отправить
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
