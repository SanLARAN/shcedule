import type { GhComment, GhIssue, GhReaction, GhUser } from './types'

const API = 'https://api.github.com'
const OAUTH = 'https://github.com'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function friendly(status: number, message: string): string {
  if (status === 401) return 'Вход недействителен или токен истёк — войдите заново.'
  if (status === 404) return 'Репозиторий или обсуждение не найдены. Проверьте owner/repo в настройках.'
  if (status === 403) {
    if (/rate limit/i.test(message)) {
      return 'Исчерпан лимит запросов к GitHub API. Войдите в аккаунт — лимит станет в 80 раз больше.'
    }
    return 'Недостаточно прав для этого действия в репозитории.'
  }
  if (status === 422) return 'GitHub отклонил запрос: проверьте поля (возможно, пустой заголовок).'
  return message || `Ошибка GitHub API (${status})`
}

type ReqOpts = {
  token?: string | null
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
  body?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
}

export type GhResponse<T> = {
  data: T
  status: number
  headers: Headers
}

async function request<T>(url: string, opts: ReqOpts = {}): Promise<GhResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(opts.headers || {}),
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      redirect: 'follow',
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('Нет связи с GitHub. Проверьте интернет-соединение.', 0)
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    let message = res.statusText
    if (data && typeof data === 'object' && 'message' in data) {
      const raw = (data as { message?: unknown }).message
      if (typeof raw === 'string' && raw) message = raw
    }
    const err = new ApiError(friendly(res.status, message), res.status)
    ;(err as ApiError & { raw?: unknown }).raw = data
    throw err
  }

  return { data: data as T, status: res.status, headers: res.headers }
}

/* ------------------------------------------------------------------ */
/* Репозиторий и аккаунт                                              */
/* ------------------------------------------------------------------ */

export type GhRepo = {
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  open_issues_count: number
  has_issues: boolean
  permissions?: { admin: boolean; push: boolean; triage: boolean; pull: boolean }
  owner: { login: string; avatar_url: string }
}

export function getRepo(owner: string, repo: string, token?: string | null, signal?: AbortSignal) {
  return request<GhRepo>(`${API}/repos/${owner}/${repo}`, { token, signal })
}

export function getAuthenticatedUser(token: string, signal?: AbortSignal) {
  return request<GhUser>(`${API}/user`, { token, signal })
}

export function getRateLimit(token?: string | null, signal?: AbortSignal) {
  return request<{ resources: { core: { limit: number; remaining: number; reset: number } } }>(`${API}/rate_limit`, {
    token,
    signal,
  })
}

/* ------------------------------------------------------------------ */
/* Обсуждения (issues)                                                */
/* ------------------------------------------------------------------ */

export function listIssues(
  owner: string,
  repo: string,
  params: { page?: number; perPage?: number; state?: 'open' | 'closed' | 'all'; sort?: string; direction?: 'asc' | 'desc' },
  token?: string | null,
  signal?: AbortSignal,
) {
  const q = new URLSearchParams({
    state: params.state || 'all',
    sort: params.sort || 'updated',
    direction: params.direction || 'desc',
    per_page: String(params.perPage || 30),
    page: String(params.page || 1),
  })
  return request<GhIssue[]>(`${API}/repos/${owner}/${repo}/issues?${q}`, { token, signal })
}

export function getIssue(owner: string, repo: string, number: number, token?: string | null, signal?: AbortSignal) {
  return request<GhIssue>(`${API}/repos/${owner}/${repo}/issues/${number}`, { token, signal })
}

export function listComments(owner: string, repo: string, number: number, token?: string | null, signal?: AbortSignal) {
  const q = new URLSearchParams({ per_page: '100', sort: 'created', direction: 'asc' })
  return request<GhComment[]>(`${API}/repos/${owner}/${repo}/issues/${number}/comments?${q}`, { token, signal })
}

export type CreateIssueInput = {
  title: string
  body: string
  labels?: string[]
}

export function createIssue(
  owner: string,
  repo: string,
  input: CreateIssueInput,
  token: string,
  signal?: AbortSignal,
) {
  return request<GhIssue>(`${API}/repos/${owner}/${repo}/issues`, {
    token,
    method: 'POST',
    body: { title: input.title, body: input.body, labels: input.labels?.filter(Boolean) },
    signal,
  })
}

export function createComment(
  owner: string,
  repo: string,
  number: number,
  body: string,
  token: string,
  signal?: AbortSignal,
) {
  return request<GhComment>(`${API}/repos/${owner}/${repo}/issues/${number}/comments`, {
    token,
    method: 'POST',
    body: { body },
    signal,
  })
}

/* ------------------------------------------------------------------ */
/* Реакции (лайки)                                                    */
/* ------------------------------------------------------------------ */

export function listReactions(owner: string, repo: string, number: number, token?: string | null, signal?: AbortSignal) {
  const q = new URLSearchParams({ per_page: '100', content: '+1' })
  return request<GhReaction[]>(`${API}/repos/${owner}/${repo}/issues/${number}/reactions?${q}`, { token, signal })
}

export function addReaction(owner: string, repo: string, number: number, token: string, signal?: AbortSignal) {
  return request<GhReaction>(`${API}/repos/${owner}/${repo}/issues/${number}/reactions`, {
    token,
    method: 'POST',
    body: { content: '+1' },
    signal,
  })
}

export function removeReaction(owner: string, repo: string, number: number, reactionId: number, token: string, signal?: AbortSignal) {
  return request<unknown>(`${API}/repos/${owner}/${repo}/issues/${number}/reactions/${reactionId}`, {
    token,
    method: 'DELETE',
    signal,
  })
}

/* ------------------------------------------------------------------ */
/* Device Flow — вход через GitHub без собственного сервера            */
/* ------------------------------------------------------------------ */

export type DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export function startDeviceFlow(clientId: string) {
  return request<DeviceCodeResponse>(`${OAUTH}/login/device/code`, {
    method: 'POST',
    body: { client_id: clientId, scope: 'public_repo' },
  })
}

export type TokenPollResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'ok'; token: string }
  | { status: 'error'; message: string }

/** Один шаг опроса токена (по спецификации Device Flow). */
export async function pollDeviceToken(clientId: string, deviceCode: string): Promise<TokenPollResult> {
  const res = await fetch(`${OAUTH}/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
    error_description?: string
    interval?: number
  }
  if (data.access_token) return { status: 'ok', token: data.access_token }
  switch (data.error) {
    case 'authorization_pending':
      return { status: 'pending' }
    case 'slow_down':
      return { status: 'slow_down', interval: data.interval || 10 }
    case 'expired_token':
      return { status: 'error', message: 'Код истёк. Начните вход заново.' }
    case 'access_denied':
      return { status: 'error', message: 'Вы отменили авторизацию.' }
    case 'device_flow_disabled':
      return { status: 'error', message: 'В OAuth App не включён Device Flow (Settings → включите его).' }
    default:
      return { status: 'error', message: data.error_description || data.error || 'Не удалось получить токен.' }
  }
}

/* ------------------------------------------------------------------ */
/* Поиск по issues                                                    */
/* ------------------------------------------------------------------ */

export function searchIssues(
  owner: string,
  repo: string,
  query: string,
  token?: string | null,
  signal?: AbortSignal,
) {
  const q = `repo:${owner}/${repo} is:issue ${query}`.trim()
  const params = new URLSearchParams({ q, per_page: '30', sort: 'updated', order: 'desc' })
  return request<{ total_count: number; items: GhIssue[] }>(`${API}/search/issues?${params}`, { token, signal })
}

/** Публичный профиль пользователя GitHub (без токена доступно 60 запросов/час) */
export function getUser(login: string, token?: string | null, signal?: AbortSignal) {
  return request<GhUser & { public_repos: number; followers: number; created_at: string }>(`${API}/users/${login}`, {
    token,
    signal,
  })
}
