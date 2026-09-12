import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CATEGORIES } from '../config'
import { useStore } from '../lib/store'
import type { Thread } from '../lib/model'
import { Avatar, EmptyState, ErrorState, Icon, SkeletonCard, Spinner } from '../ui/components'
import { ThreadCard } from '../ui/ThreadCard'
import { classNames, plural, timeAgo } from '../lib/format'
import * as gh from '../lib/github'
import type { GhUser } from '../lib/types'

/* ---------------------------- раздел (категория) ---------------------------- */

export function CategoryPage() {
  const { id } = useParams()
  const category = CATEGORIES.find((c) => c.id === id)
  const { loadThreads } = useStore()
  const [items, setItems] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    loadThreads({ page: 1, perPage: 50 })
      .then((res) => {
        if (alive) setItems(res.items.filter((t) => t.category === id))
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!category) {
    return <EmptyState emoji="🤔" title="Такого раздела нет" action={<Link className="btn btn--primary" to="/">На главную</Link>} />
  }

  return (
    <div className="category-page">
      <header className="page-head" style={{ ['--cat' as string]: category.color }}>
        <div className="page-head__emoji" aria-hidden="true">{category.emoji}</div>
        <div>
          <h1 className="page-title">{category.label}</h1>
          <p className="page-subtitle">{category.description}</p>
        </div>
        <Link className="btn btn--primary" to={`/new?c=${category.id}`}>
          <Icon name="plus" size={17} /> Новая тема
        </Link>
      </header>

      {loading ? (
        <div className="feed">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length ? (
        <div className="feed">
          {items.map((t) => (
            <ThreadCard key={t.number} thread={t} showCategory={false} />
          ))}
        </div>
      ) : (
        <EmptyState
          emoji={category.emoji}
          title={`В разделе «${category.label}» пока пусто`}
          text="Станьте первым, кто откроет здесь тему."
          action={
            <Link className="btn btn--primary" to={`/new?c=${category.id}`}>
              <Icon name="plus" size={17} /> Создать тему
            </Link>
          }
        />
      )}
    </div>
  )
}

/* -------------------------------- участники -------------------------------- */

type Member = { login: string; avatar: string; url: string; threads: number; comments: number; likes: number; last: string }

export function MembersPage() {
  const { loadThreads, isDemo } = useStore()
  const [members, setMembers] = useState<Member[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadThreads({ page: 1, perPage: 100 })
      .then((res) => {
        if (!alive) return
        const map = new Map<string, Member>()
        for (const t of res.items) {
          const cur = map.get(t.author.login)
          if (cur) {
            cur.threads += 1
            cur.comments += t.comments
            cur.likes += t.likes
            if (new Date(t.updatedAt) > new Date(cur.last)) cur.last = t.updatedAt
          } else {
            map.set(t.author.login, {
              login: t.author.login,
              avatar: t.author.avatar,
              url: t.author.url,
              threads: 1,
              comments: t.comments,
              likes: t.likes,
              last: t.updatedAt,
            })
          }
        }
        setMembers([...map.values()].sort((a, b) => b.threads - a.threads || b.comments - a.comments))
        setCount(res.items.length)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(
    () => members.filter((m) => m.login.toLowerCase().includes(query.trim().toLowerCase())),
    [members, query],
  )

  return (
    <div className="members-page">
      <h1 className="page-title">Участники</h1>
      <p className="page-subtitle">
        {loading ? 'Считаем…' : `${members.length} ${plural(members.length, ['автор', 'автора', 'авторов'])} в ${count} ${plural(count, ['теме', 'темах', 'темах'])}`}
        {isDemo ? ' · демо-данные' : ''}
      </p>

      <div className="search search--page">
        <Icon name="search" size={16} />
        <input className="search__input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти участника по нику" />
      </div>

      {loading ? (
        <div className="feed">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : visible.length ? (
        <div className="member-grid">
          {visible.map((m) => (
            <Link key={m.login} to={`/u/${m.login}`} className="member-card">
              <Avatar author={{ login: m.login, avatar: m.avatar, url: m.url }} size={52} />
              <div className="member-card__info">
                <b>@{m.login}</b>
                <span className="muted small">
                  {m.threads} {plural(m.threads, ['тема', 'темы', 'тем'])} · {m.comments}{' '}
                  {plural(m.comments, ['ответ', 'ответа', 'ответов'])}
                </span>
                <span className="muted xsmall">активность {timeAgo(m.last)}</span>
              </div>
              <span className="member-card__likes">❤ {m.likes}</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState emoji="👥" title="Участники не найдены" text="Попробуйте изменить запрос." />
      )}
    </div>
  )
}

/* --------------------------------- профиль --------------------------------- */

export function UserPage() {
  const { login = '' } = useParams()
  const { loadThreads, session, isDemo } = useStore()
  const [profile, setProfile] = useState<GhUser | null>(null)
  const [items, setItems] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    const loadProfile = isDemo
      ? Promise.resolve(null)
      : gh
          .getUser(login, session.token)
          .then((res) => res.data)
          .catch(() => null)

    Promise.all([loadProfile, loadThreads({ page: 1, perPage: 100 }), Promise.resolve()])
      .then(([user, res]) => {
        if (!alive) return
        setProfile(user)
        setItems(res.items.filter((t) => t.author.login.toLowerCase() === login.toLowerCase()))
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login])

  const fallbackAvatar = items[0]?.author.avatar || ''
  const fallbackUrl = items[0]?.author.url || `https://github.com/${login}`

  return (
    <div className="user-page">
      {loading ? (
        <div className="feed">
          {[0, 1].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          <header className="profile">
            <Avatar author={{ login, avatar: profile?.avatar_url || fallbackAvatar, url: fallbackUrl }} size={72} />
            <div className="profile__info">
              <h1 className="page-title">@{login}</h1>
              {profile?.name ? <p className="page-subtitle">{profile.name}</p> : null}
              {profile?.bio ? <p className="muted">{profile.bio}</p> : null}
              <div className="profile__stats">
                <span>
                  <b>{items.length}</b> {plural(items.length, ['тема', 'темы', 'тем'])}
                </span>
                <span>
                  <b>{items.reduce((s, t) => s + t.comments, 0)}</b> {plural(items.reduce((s, t) => s + t.comments, 0), ['ответ', 'ответа', 'ответов'])}
                </span>
                <span>
                  <b>{items.reduce((s, t) => s + t.likes, 0)}</b> реакций
                </span>
              </div>
            </div>
            {!isDemo ? (
              <a className="btn btn--ghost" href={`https://github.com/${login}`} target="_blank" rel="noopener noreferrer">
                <Icon name="github" size={16} /> GitHub
              </a>
            ) : null}
          </header>

          {error ? <ErrorState message={error} /> : null}

          {items.length ? (
            <div className="feed">
              {items.map((t) => (
                <ThreadCard key={t.number} thread={t} />
              ))}
            </div>
          ) : (
            <EmptyState
              emoji="✍️"
              title={`У @${login} пока нет тем`}
              text="Самое время открыть первую — она появится здесь."
              action={
                <Link className="btn btn--primary" to="/new">
                  <Icon name="plus" size={17} /> Создать тему
                </Link>
              }
            />
          )}
        </>
      )}
    </div>
  )
}

/* ---------------------------------- о форуме ------------------------------- */

export function AboutPage() {
  const { config, isDemo, repoInfo, session } = useStore()
  const steps = [
    ['Войдите через GitHub', 'Кнопка «Войти» в шапке: подтверждаете код на github.com — пароль сайту не передаётся.'],
    ['Напишите тему', 'Заголовок, раздел, теги и текст в Markdown с предпросмотром.'],
    ['Публикация', 'Сайт создаёт issue в репозитории за пару секунд. Если прав на запись нет — откроется форма GitHub с уже заполненным текстом.'],
    ['Обсуждение', 'Ответы становятся комментариями к issue, реакции — лайками на форуме.'],
  ]

  return (
    <div className="about-page">
      <h1 className="page-title">О форуме</h1>
      <p className="page-subtitle">
        {config.title} — {config.tagline.toLowerCase()}. Статический сайт на GitHub Pages: никаких серверов и баз данных,
        всё содержимое живёт в GitHub Issues.
      </p>

      <section className="panel">
        <h2 className="panel__title">Как это работает</h2>
        <ol className="steps">
          {steps.map(([title, text], i) => (
            <li key={title}>
              <span className="steps__num">{i + 1}</span>
              <div>
                <b>{title}</b>
                <p className="muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" id="rules">
        <h2 className="panel__title">Правила</h2>
        <ul className="rules">
          <li>Уважайте собеседников: критикуйте идеи, а не людей.</li>
          <li>Пишите в подходящий раздел и давайте контекст в первом сообщении.</li>
          <li>Реклама и спам — только по согласованию с администрацией.</li>
          <li>Не публикуйте личные данные и токены доступа.</li>
          <li>Перед вопросом загляните в поиск — возможно, ответ уже есть.</li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel__title">Разделы</h2>
        <div className="cat-cards">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="cat-card" style={{ ['--cat' as string]: c.color }}>
              <span className="cat-card__emoji" aria-hidden="true">{c.emoji}</span>
              <b>{c.label}</b>
              <span className="muted small">{c.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">Техника</h2>
        <ul className="kv">
          <li>
            <span>Хостинг</span>
            <b>GitHub Pages (статика)</b>
          </li>
          <li>
            <span>Хранилище</span>
            <b>{isDemo ? 'localStorage (демо)' : `${config.owner}/${config.repo} · Issues`}</b>
          </li>
          <li>
            <span>Вход</span>
            <b>{config.clientId ? 'GitHub OAuth (device flow)' : 'GitHub-токен'}</b>
          </li>
          <li>
            <span>Ваш статус</span>
            <b>{session.user ? `@${session.user.login}` : 'гость'}</b>
          </li>
          {repoInfo ? (
            <li>
              <span>Звёзд у репозитория</span>
              <b>★ {repoInfo.stargazers_count}</b>
            </li>
          ) : null}
        </ul>
        <div className={classNames('notice', 'small', !config.clientId && 'notice--warn')}>
          Владельцу: чтобы включить вход по коду, создайте OAuth App с Device Flow и укажите client_id в «Настройках».
          Ещё можно включить Issues и добавить шаблон темы — тогда писать смогут все, а посты будут приходить на модерацию.
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">Ссылки</h2>
        <div className="row row--gap">
          <a className="btn btn--ghost" href={`https://github.com/${config.owner}/${config.repo}`} target="_blank" rel="noopener noreferrer">
            <Icon name="github" size={16} /> Репозиторий
          </a>
          <Link className="btn btn--ghost" to="/new">
            <Icon name="plus" size={16} /> Создать тему
          </Link>
          <a
            className="btn btn--ghost"
            href={`https://github.com/${config.owner}/${config.repo}/issues/new`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external" size={16} /> Новая issue на GitHub
          </a>
        </div>
      </section>
    </div>
  )
}

/* ----------------------------------- 404 ---------------------------------- */

export function NotFoundPage() {
  return (
    <EmptyState
      emoji="🧭"
      title="Страница не найдена"
      text="Возможно, ссылка устарела или тему удалили."
      action={
        <Link className="btn btn--primary" to="/">
          На главную
        </Link>
      }
    />
  )
}

export { Spinner }
