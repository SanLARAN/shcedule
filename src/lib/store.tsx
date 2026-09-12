import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_CONFIG, LS_PREFIX, type ForumConfig } from '../config'
import * as gh from './github'
import { ApiError, type GhRepo } from './github'
import type { GhUser } from './types'
import {
  buildBody,
  commentToThread,
  githubNewIssueUrl,
  isForumPost,
  issueToThread,
  type NewThreadInput,
  type Thread,
  type ThreadComment,
} from './model'
import * as demo from './demo'

/* ------------------------------------------------------------------ */
/* Небольшой кеш ответов API с TTL                                     */
/* ------------------------------------------------------------------ */

const CACHE_PREFIX = `${LS_PREFIX}cache:`

type CacheEntry<T> = { at: number; data: T }

function cacheRead<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

function cacheWrite<T>(key: string, data: T) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* хранилище переполнено — не критично */
  }
}

/* ------------------------------------------------------------------ */

export type ThreadsPage = {
  items: Thread[]
  hasMore: boolean
  stale?: boolean
}

export type LoadThreadsOptions = {
  page?: number
  perPage?: number
  state?: 'open' | 'closed' | 'all'
  sort?: 'updated' | 'created' | 'comments'
  /** Игнорировать кеш (например, при ручном обновлении) */
  force?: boolean
}

export type WriteResult =
  | { status: 'ok'; number?: number }
  | { status: 'needs-auth' }
  | { status: 'needs-github'; url: string }
  | { status: 'error'; message: string }

export type Session = {
  token: string | null
  user: GhUser | null
  /** Можно ли писать в репозиторий от имени вошедшего пользователя */
  canWrite: boolean
  checking: boolean
}

type StoreValue = {
  config: ForumConfig
  updateConfig: (patch: Partial<ForumConfig>) => void
  mode: 'github' | 'demo'
  switchToDemo: () => void
  switchToGithub: () => void

  session: Session
  signInWithToken: (token: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => void

  repoInfo: GhRepo | null
  repoError: string | null

  loadThreads: (opts?: LoadThreadsOptions) => Promise<ThreadsPage>
  searchThreads: (query: string) => Promise<Thread[]>
  loadThread: (number: number) => Promise<{ thread: Thread; comments: ThreadComment[] } | null>

  createThread: (input: NewThreadInput) => Promise<WriteResult>
  addComment: (number: number, body: string) => Promise<WriteResult>
  toggleLike: (number: number, liked: boolean) => Promise<WriteResult>

  isDemo: boolean
  demoAuthor: { login: string; avatar: string; url: string }
}

const StoreContext = createContext<StoreValue | null>(null)

function readConfig(): ForumConfig {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}config`)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ForumConfig>) }
  } catch {
    return DEFAULT_CONFIG
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(`${LS_PREFIX}token`)
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ForumConfig>(() => readConfig())
  const [token, setToken] = useState<string | null>(() => readToken())
  const [user, setUser] = useState<GhUser | null>(null)
  const [canWrite, setCanWrite] = useState(false)
  const [checking, setChecking] = useState(false)
  const [repoInfo, setRepoInfo] = useState<GhRepo | null>(null)
  const [repoError, setRepoError] = useState<string | null>(null)

  const isDemo = config.demo

  /* ---------------- конфигурация ---------------- */

  const updateConfig = useCallback((patch: Partial<ForumConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(`${LS_PREFIX}config`, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const switchToDemo = useCallback(() => updateConfig({ demo: true }), [updateConfig])
  const switchToGithub = useCallback(() => updateConfig({ demo: false }), [updateConfig])

  /* ---------------- авторизация ---------------- */

  const persistToken = useCallback((value: string | null) => {
    setToken(value)
    try {
      if (value) localStorage.setItem(`${LS_PREFIX}token`, value)
      else localStorage.removeItem(`${LS_PREFIX}token`)
    } catch {
      /* ignore */
    }
  }, [])

  const signOut = useCallback(() => {
    persistToken(null)
    setUser(null)
    setCanWrite(false)
  }, [persistToken])

  const validateToken = useCallback(
    async (value: string) => {
      const me = await gh.getAuthenticatedUser(value)
      setUser(me.data)
      try {
        const repo = await gh.getRepo(config.owner, config.repo, value)
        setRepoInfo(repo.data)
        setRepoError(null)
        setCanWrite(Boolean(repo.data.permissions?.push))
      } catch (e) {
        setCanWrite(false)
        if (e instanceof ApiError) setRepoError(e.message)
      }
    },
    [config.owner, config.repo],
  )

  const signInWithToken = useCallback(
    async (value: string) => {
      const clean = value.trim()
      if (!clean) return { ok: false, message: 'Пустой токен' }
      setChecking(true)
      try {
        persistToken(clean)
        await validateToken(clean)
        return { ok: true }
      } catch (e) {
        persistToken(null)
        setUser(null)
        setCanWrite(false)
        return { ok: false, message: e instanceof Error ? e.message : 'Не удалось проверить токен' }
      } finally {
        setChecking(false)
      }
    },
    [persistToken, validateToken],
  )

  // Проверяем сохранённый токен и репозиторий при старте и при смене репозитория.
  useEffect(() => {
    let alive = true
    const controller = new AbortController()

    async function boot() {
      setChecking(true)
      try {
        const repo = await gh.getRepo(config.owner, config.repo, token, controller.signal)
        if (!alive) return
        setRepoInfo(repo.data)
        setRepoError(null)
        setCanWrite(Boolean(token && repo.data.permissions?.push))
      } catch (e) {
        if (!alive) return
        setRepoInfo(null)
        if (e instanceof ApiError && (e as Error).name !== 'AbortError') setRepoError(e.message)
        else setRepoError(e instanceof Error ? e.message : 'Не удалось получить данные репозитория')
        setCanWrite(false)
      }

      if (token) {
        try {
          const me = await gh.getAuthenticatedUser(token, controller.signal)
          if (alive) setUser(me.data)
        } catch {
          if (alive) {
            persistToken(null)
            setUser(null)
          }
        }
      } else if (alive) {
        setUser(null)
      }

      if (alive) setChecking(false)
    }

    if (config.demo) {
      setChecking(false)
      setRepoError(null)
      return () => {
        alive = false
        controller.abort()
      }
    }

    void boot()
    return () => {
      alive = false
      controller.abort()
    }
  }, [config.owner, config.repo, config.demo, token, persistToken])

  /* ---------------- чтение ---------------- */

  const loadThreads = useCallback(
    async (opts: LoadThreadsOptions = {}): Promise<ThreadsPage> => {
      if (config.demo) {
        const all = demo.demoListThreads()
        return { items: all.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)), hasMore: false }
      }

      const page = opts.page || 1
      const perPage = opts.perPage || 20
      const state = opts.state || 'all'
      const sort = opts.sort || 'updated'
      const key = `threads:${config.owner}/${config.repo}:${state}:${sort}:${perPage}:${page}`
      const cached = cacheRead<ThreadsPage>(key)
      const fresh = cached && Date.now() - cached.at < 60_000

      if (fresh && !opts.force) return cached!.data

      try {
        const res = await gh.listIssues(
          config.owner,
          config.repo,
          { page, perPage, state, sort, direction: 'desc' },
          token,
        )
        const items = res.data.filter((issue) => isForumPost(issue, config.owner)).map(issueToThread)
        const link = res.headers.get('link') || ''
        const hasMore = /rel="next"/.test(link)
        const data: ThreadsPage = { items, hasMore }
        cacheWrite(key, data)
        setRepoError(null)
        return data
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка загрузки'
        if (cached) return { ...cached.data, stale: true }
        setRepoError(message)
        throw e
      }
    },
    [config.demo, config.owner, config.repo, token],
  )

  const searchThreads = useCallback(
    async (query: string): Promise<Thread[]> => {
      const q = query.trim()
      if (!q) return []
      if (config.demo) {
        const needle = q.toLowerCase()
        return demo
          .demoListThreads()
          .filter((t) => (t.title + ' ' + t.body + ' ' + t.author.login + ' ' + t.tags.join(' ')).toLowerCase().includes(needle))
      }
      const res = await gh.searchIssues(config.owner, config.repo, q, token)
      return res.data.items.filter((issue) => isForumPost(issue, config.owner)).map(issueToThread)
    },
    [config.demo, config.owner, config.repo, token],
  )

  const loadThread = useCallback(
    async (number: number): Promise<{ thread: Thread; comments: ThreadComment[] } | null> => {
      if (config.demo) {
        const { thread, comments } = demo.demoGetThread(number)
        return thread ? { thread, comments } : null
      }
      const key = `thread:${config.owner}/${config.repo}:${number}`
      const cached = cacheRead<{ thread: Thread; comments: ThreadComment[] }>(key)
      try {
        const [issueRes, commentsRes] = await Promise.all([
          gh.getIssue(config.owner, config.repo, number, token),
          gh.listComments(config.owner, config.repo, number, token),
        ])
        const thread = issueToThread(issueRes.data)
        const comments = commentsRes.data.map(commentToThread)

        if (token && user) {
          try {
            const reactions = await gh.listReactions(config.owner, config.repo, number, token)
            const mine = reactions.data.find((r) => r.user?.login === user.login)
            thread.likedByMe = Boolean(mine)
            thread.likes = Math.max(thread.likes, reactions.data.length)
          } catch {
            /* реакции недоступны — не критично */
          }
        }

        const data = { thread, comments }
        cacheWrite(key, data)
        return data
      } catch (e) {
        if (cached) return cached.data
        throw e
      }
    },
    [config.demo, config.owner, config.repo, token, user],
  )

  /* ---------------- запись ---------------- */

  const demoAuthor = useMemo(
    () => ({
      login: user?.login || 'guest',
      avatar: user?.avatar_url || '',
      url: user?.html_url || '',
    }),
    [user],
  )

  const guardWrite = useCallback((): WriteResult | null => {
    if (config.demo) return null
    if (!token) return { status: 'needs-auth' }
    if (!canWrite) {
      return {
        status: 'needs-github',
        url: githubNewIssueUrl(config.owner, config.repo),
      }
    }
    return null
  }, [canWrite, config.demo, config.owner, config.repo, token])

  const createThread = useCallback(
    async (input: NewThreadInput): Promise<WriteResult> => {
      const blocked = guardWrite()
      if (blocked && blocked.status === 'needs-github') {
        return { status: 'needs-github', url: githubNewIssueUrl(config.owner, config.repo, input) }
      }
      if (blocked) return blocked

      try {
        if (config.demo) {
          const thread = demo.demoCreateThread(input, demoAuthor)
          return { status: 'ok', number: thread.number }
        }
        const body = buildBody(input.body, { category: input.category, tags: input.tags, author: user?.login })
        const labels = await gh.ensureLabels(
          config.owner,
          config.repo,
          ['forum', `cat:${input.category}`, ...input.tags.slice(0, 3)],
          token!,
        )
        const res = await gh.createIssue(
          config.owner,
          config.repo,
          { title: input.title, body, labels },
          token!,
        )
        return { status: 'ok', number: res.data.number }
      } catch (e) {
        return { status: 'error', message: e instanceof Error ? e.message : 'Не удалось создать пост' }
      }
    },
    [config.demo, config.owner, config.repo, demoAuthor, guardWrite, token, user],
  )

  const addComment = useCallback(
    async (number: number, body: string): Promise<WriteResult> => {
      const blocked = guardWrite()
      if (blocked && blocked.status === 'needs-github') return blocked
      if (blocked) return blocked

      try {
        if (config.demo) {
          const comment = demo.demoAddComment(number, body, demoAuthor)
          return { status: 'ok', number: comment.id }
        }
        const res = await gh.createComment(config.owner, config.repo, number, body.trim(), token!)
        return { status: 'ok', number: res.data.id }
      } catch (e) {
        return { status: 'error', message: e instanceof Error ? e.message : 'Не удалось отправить ответ' }
      }
    },
    [config.demo, config.owner, config.repo, demoAuthor, guardWrite, token],
  )

  const toggleLike = useCallback(
    async (number: number, liked: boolean): Promise<WriteResult> => {
      if (config.demo) {
        demo.demoToggleLike(number)
        return { status: 'ok' }
      }
      if (!token) return { status: 'needs-auth' }
      try {
        if (!liked) {
          const reactions = await gh.listReactions(config.owner, config.repo, number, token)
          const mine = reactions.data.find((r) => r.user?.login === user?.login)
          if (mine) await gh.removeReaction(config.owner, config.repo, number, mine.id, token)
        } else {
          await gh.addReaction(config.owner, config.repo, number, token)
        }
        return { status: 'ok' }
      } catch (e) {
        return { status: 'error', message: e instanceof Error ? e.message : 'Не удалось поставить реакцию' }
      }
    },
    [config.demo, config.owner, config.repo, token, user],
  )

  const value: StoreValue = {
    config,
    updateConfig,
    mode: config.demo ? 'demo' : 'github',
    switchToDemo,
    switchToGithub,
    session: { token, user, canWrite, checking },
    signInWithToken,
    signOut,
    repoInfo,
    repoError,
    loadThreads,
    searchThreads,
    loadThread,
    createThread,
    addComment,
    toggleLike,
    isDemo,
    demoAuthor,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore должен вызываться внутри <StoreProvider>')
  return ctx
}

/** Данные с автоматической загрузкой (для страниц). */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    loaderRef
      .current()
      .then((result) => {
        if (alive) setData(result)
      })
      .catch((e: unknown) => {
        if (!alive) return
        if ((e as Error)?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить данные')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
