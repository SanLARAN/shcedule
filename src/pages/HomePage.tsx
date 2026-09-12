import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES, getCategory } from '../config'
import { useStore } from '../lib/store'
import type { Thread } from '../lib/model'
import { EmptyState, ErrorState, Icon, SkeletonCard, Spinner } from '../ui/components'
import { ThreadCard, ThreadRow } from '../ui/ThreadCard'
import { useUI } from '../ui/context'
import { classNames, plural } from '../lib/format'

type Sort = 'updated' | 'created' | 'comments'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'updated', label: 'Активные' },
  { id: 'created', label: 'Новые' },
  { id: 'comments', label: 'Обсуждаемые' },
]

const BANNER_KEY = 'forum:hide-welcome'

function mergeById(prev: Thread[], next: Thread[]): Thread[] {
  const map = new Map<number, Thread>()
  for (const t of prev) map.set(t.number, t)
  for (const t of next) map.set(t.number, t)
  return [...map.values()]
}

export function HomePage({ lockedCategory }: { lockedCategory?: string }) {
  const { loadThreads, searchThreads, config, isDemo, repoInfo, session, toggleLike } = useStore()
  const { openSignIn, toast, openGithubWrite } = useUI()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''

  const [sort, setSort] = useState<Sort>('updated')
  const [category, setCategory] = useState<string>(lockedCategory || 'all')
  const [onlyUnanswered, setOnlyUnanswered] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Thread[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [stale, setStale] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [searchBusy, setSearchBusy] = useState(false)
  const [showBanner, setShowBanner] = useState(() => {
    try {
      return localStorage.getItem(BANNER_KEY) !== '1'
    } catch {
      return true
    }
  })

  const effectiveCategory = lockedCategory || category
  const feedKey = `${sort}|${effectiveCategory}|${query}|${onlyUnanswered}`
  const prevKey = useRef(feedKey)

  useEffect(() => {
    if (prevKey.current !== feedKey) {
      prevKey.current = feedKey
      setItems([])
      setPage(1)
    }
  }, [feedKey])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    const run = async () => {
      if (query) {
        setSearchBusy(true)
        const found = await searchThreads(query)
        if (!alive) return
        setItems(found)
        setHasMore(false)
        return
      }
      const res = await loadThreads({ page, perPage: 20, state: 'all', sort })
      if (!alive) return
      setItems((prev) => (page === 1 ? res.items : mergeById(prev, res.items)))
      setHasMore(res.hasMore)
      setStale(Boolean(res.stale))
    }

    run()
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить темы')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
        setSearchBusy(false)
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKey, page, tick])

  const visible = useMemo(() => {
    let list = items
    if (effectiveCategory !== 'all') list = list.filter((t) => t.category === effectiveCategory)
    if (onlyUnanswered) list = list.filter((t) => t.comments === 0 && t.state === 'open')
    return list
  }, [items, effectiveCategory, onlyUnanswered])

  const pinned = useMemo(() => visible.filter((t) => t.pinned), [visible])
  const rest = useMemo(() => visible.filter((t) => !t.pinned), [visible])

  const topAuthors = useMemo(() => {
    const count = new Map<string, { login: string; avatar: string; url: string; n: number }>()
    for (const t of items) {
      const cur = count.get(t.author.login)
      if (cur) cur.n += 1
      else count.set(t.author.login, { ...t.author, n: 1 })
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 5)
  }, [items])

  const hottest = useMemo(() => [...items].sort((a, b) => b.comments - a.comments).slice(0, 4), [items])

  async function handleLike(thread: Thread, liked: boolean) {
    if (isDemo || !session.user) {
      const res = await toggleLike(thread.number, liked)
      if (res.status === 'needs-auth') {
        openSignIn()
        return
      }
      if (res.status === 'error') toast(res.message, 'error')
      setItems((prev) => prev.map((t) => (t.number === thread.number ? { ...t, likedByMe: liked, likes: t.likes + (liked ? 1 : -1) } : t)))
      return
    }
    const res = await toggleLike(thread.number, liked)
    if (res.status === 'ok') {
      setItems((prev) => prev.map((t) => (t.number === thread.number ? { ...t, likedByMe: liked, likes: t.likes + (liked ? 1 : -1) } : t)))
    } else if (res.status === 'needs-github') {
      openGithubWrite(res.url, 'Реакция через GitHub')
    } else if (res.status === 'error') {
      toast(res.message, 'error')
    }
  }

  function refresh() {
    setTick((t) => t + 1)
  }

  const showSkeleton = loading && items.length === 0

  return (
    <div className="home">
      {!lockedCategory ? (
        <section className="hero">
          <div className="hero__main">
            <h1 className="hero__title">{config.title}</h1>
            <p className="hero__text">
              {config.tagline}. Темы и ответы живут в GitHub Issues, а сайт — обычная статика на GitHub Pages, поэтому
              форум ничего не стоит в хостинге.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--primary" to="/new">
                <Icon name="plus" size={17} /> Создать тему
              </Link>
              <Link className="btn btn--ghost" to="/about">
                Как это работает
              </Link>
            </div>
          </div>
          <dl className="hero__stats">
            <div>
              <dt>Тем</dt>
              <dd>{items.length}{hasMore ? '+' : ''}</dd>
            </div>
            <div>
              <dt>Ответов</dt>
              <dd>{items.reduce((sum, t) => sum + t.comments, 0)}</dd>
            </div>
            <div>
              <dt>Разделов</dt>
              <dd>{CATEGORIES.length}</dd>
            </div>
            <div>
              <dt>Репозиторий</dt>
              <dd className="hero__repo">
                {isDemo ? 'демо' : (
                  <a href={`https://github.com/${config.owner}/${config.repo}`} target="_blank" rel="noopener noreferrer">
                    {config.owner}/{config.repo}
                  </a>
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {showBanner && !lockedCategory ? (
        <div className="welcome">
          <div>
            <b>Вы на статическом форуме.</b> Чтение открыто всем, а для публикации нужно войти через GitHub — посты
            автоматически становятся темами в репозитории {isDemo ? 'демо-хранилище' : `${config.owner}/${config.repo}`}.
          </div>
          <div className="row row--gap">
            {!session.user ? (
              <button type="button" className="btn btn--sm btn--primary" onClick={openSignIn}>
                Войти
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setShowBanner(false)
                try {
                  localStorage.setItem(BANNER_KEY, '1')
                } catch {
                  /* ignore */
                }
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}

      <div className="layout">
        <div className="layout__main">
          <div className="toolbar">
            <div className="tabs" role="tablist" aria-label="Сортировка">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={sort === s.id && !query}
                  className={classNames('tab', sort === s.id && !query && 'is-active')}
                  onClick={() => {
                    setSort(s.id)
                    setPage(1)
                    if (query) setParams({})
                  }}
                >
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                className={classNames('tab', onlyUnanswered && 'is-active')}
                onClick={() => {
                  setOnlyUnanswered((v) => !v)
                  setPage(1)
                }}
                title="Показать темы без ответов"
              >
                Без ответа
              </button>
            </div>
            <button type="button" className="btn btn--sm btn--ghost" onClick={refresh} disabled={loading}>
              {loading ? <Spinner size={15} /> : 'Обновить'}
            </button>
          </div>

          {!lockedCategory ? (
            <div className="chips">
              <button
                type="button"
                className={classNames('chip', effectiveCategory === 'all' && 'is-active')}
                onClick={() => {
                  setCategory('all')
                  setPage(1)
                }}
              >
                Все разделы
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={classNames('chip', effectiveCategory === c.id && 'is-active')}
                  onClick={() => {
                    setCategory(c.id)
                    setPage(1)
                  }}
                >
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          ) : null}

          {query ? (
            <div className="search-note">
              Результаты поиска по запросу «<b>{query}</b>»{searchBusy ? ' — ищем…' : ''}
              <button type="button" className="btn btn--xs btn--ghost" onClick={() => setParams({})}>
                Сбросить
              </button>
            </div>
          ) : null}

          {stale ? <div className="notice notice--warn small">Показаны данные из кеша — GitHub временно недоступен.</div> : null}
          {error ? <ErrorState message={error} onRetry={refresh} /> : null}

          {showSkeleton ? (
            <div className="feed">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : null}

          {!showSkeleton && !error ? (
            <>
              {pinned.length ? (
                <div className="feed feed--pinned">
                  {pinned.map((t) => (
                    <ThreadCard key={t.number} thread={t} pinned onLike={handleLike} />
                  ))}
                </div>
              ) : null}

              {rest.length ? (
                <div className="feed">
                  {rest.map((t) => (
                    <ThreadCard key={t.number} thread={t} onLike={handleLike} />
                  ))}
                </div>
              ) : pinned.length ? null : (
                <EmptyState
                  emoji={onlyUnanswered ? '🎉' : '🌱'}
                  title={onlyUnanswered ? 'Тем без ответа нет' : 'Здесь пока пусто'}
                  text={
                    onlyUnanswered
                      ? 'Все вопросы получили ответы — отличная работа сообщества.'
                      : 'Создайте первую тему — она появится на форуме и в репозитории GitHub.'
                  }
                  action={
                    <Link className="btn btn--primary" to="/new">
                      <Icon name="plus" size={17} /> Создать тему
                    </Link>
                  }
                />
              )}

              {hasMore && !query ? (
                <div className="load-more">
                  <button type="button" className="btn" onClick={() => setPage((p) => p + 1)} disabled={loading}>
                    {loading ? <Spinner size={15} label="Загружаем…" /> : 'Показать ещё'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="layout__aside">
          <section className="panel">
            <h2 className="panel__title">Разделы</h2>
            <ul className="cat-list">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link to={`/c/${c.id}`} className="cat-list__item">
                    <span className="cat-list__dot" style={{ background: c.color }} aria-hidden="true" />
                    <span className="cat-list__label">{c.label}</span>
                    <span className="cat-list__count">{items.filter((t) => t.category === c.id).length || ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {hottest.length ? (
            <section className="panel">
              <h2 className="panel__title">Обсуждают</h2>
              <ul className="thread-rows">
                {hottest.map((t) => (
                  <ThreadRow key={t.number} thread={t} />
                ))}
              </ul>
            </section>
          ) : null}

          {topAuthors.length ? (
            <section className="panel">
              <h2 className="panel__title">Активные участники</h2>
              <ul className="author-list">
                {topAuthors.map((a) => (
                  <li key={a.login}>
                    <Link to={`/u/${a.login}`}>
                      <img className="avatar" src={a.avatar} alt="" width={28} height={28} loading="lazy" />
                      <span>@{a.login}</span>
                      <b>
                        {a.n} {plural(a.n, ['тема', 'темы', 'тем'])}
                      </b>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className="btn btn--sm btn--ghost btn--block" to="/members">
                Все участники
              </Link>
            </section>
          ) : null}

          {!isDemo && repoInfo ? (
            <section className="panel panel--muted">
              <h2 className="panel__title">Хранилище</h2>
              <p className="muted small">
                <a href={repoInfo.html_url} target="_blank" rel="noopener noreferrer">
                  {repoInfo.full_name}
                </a>
              </p>
              <ul className="kv">
                <li>
                  <span>Звёзд</span>
                  <b>★ {repoInfo.stargazers_count}</b>
                </li>
                <li>
                  <span>Открытых тем в GitHub</span>
                  <b>{repoInfo.open_issues_count}</b>
                </li>
                <li>
                  <span>Issues</span>
                  <b>{repoInfo.has_issues ? 'включены' : 'выключены'}</b>
                </li>
              </ul>
            </section>
          ) : null}

          {getCategory(effectiveCategory).id !== 'general' || lockedCategory ? (
            <section className="panel">
              <h2 className="panel__title">{getCategory(effectiveCategory).label}</h2>
              <p className="muted small">{getCategory(effectiveCategory).description}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
