import { DEFAULT_CATEGORY, CATEGORIES } from '../config'
import type { GhComment, GhIssue } from './types'
import { toPlainText } from './markdown'

/* ------------------------------------------------------------------ */
/* Модель данных приложения                                           */
/* ------------------------------------------------------------------ */

export type Author = {
  login: string
  avatar: string
  url: string
}

export type Thread = {
  number: number
  title: string
  body: string
  excerpt: string
  author: Author
  createdAt: string
  updatedAt: string
  comments: number
  likes: number
  likedByMe: boolean
  category: string
  tags: string[]
  state: 'open' | 'closed'
  htmlUrl: string
  hasImages: boolean
  /** Закреплённая тема (метка pinned/важное в GitHub) */
  pinned?: boolean
  /** Данные взяты из локального кеша, а не с GitHub */
  stale?: boolean
}

export type ThreadComment = {
  id: number
  body: string
  author: Author
  createdAt: string
  htmlUrl: string
  likes: number
}

export type NewThreadInput = {
  title: string
  body: string
  category: string
  tags: string[]
}

/* ------------------------------------------------------------------ */
/* Метаданные поста внутри текста issue                               */
/* ------------------------------------------------------------------ */

export type ForumMeta = {
  category?: string
  tags?: string[]
  author?: string
  v?: number
}

const META_RE = /^<!--\s*forum-meta:([\s\S]*?)-->\s*/

export function parseMeta(body: string): { meta: ForumMeta; clean: string } {
  const source = body || ''
  const match = source.match(META_RE)
  if (!match) return { meta: {}, clean: source }
  let meta: ForumMeta = {}
  try {
    meta = JSON.parse(match[1]) as ForumMeta
  } catch {
    meta = {}
  }
  return { meta, clean: source.slice(match[0].length) }
}

export function buildBody(markdown: string, meta: ForumMeta): string {
  const payload: ForumMeta = { v: 1, ...meta }
  return `<!-- forum-meta:${JSON.stringify(payload)} -->\n\n${markdown.trim()}`
}

/**
 * Посты, созданные через GitHub-форму (.github/ISSUE_TEMPLATE/forum-post.yml),
 * приходят как «### Заголовок раздела» + значение. Достаём из них категорию/теги.
 */
function parseIssueForm(body: string): { meta: ForumMeta; clean: string } {
  if (!/^###\s+/m.test(body)) return { meta: {}, clean: body }
  const sections: Record<string, string> = {}
  const parts = body.split(/^###\s+/m).slice(1)
  for (const part of parts) {
    const nl = part.indexOf('\n')
    const title = (nl === -1 ? part : part.slice(0, nl)).trim().toLowerCase()
    const value = (nl === -1 ? '' : part.slice(nl + 1)).trim()
    sections[title] = value
  }
  const find = (...keys: string[]) => {
    for (const key of keys) {
      for (const [title, value] of Object.entries(sections)) {
        if (title.includes(key)) return value
      }
    }
    return ''
  }
  const categoryRaw = find('категор', 'раздел', 'category').toLowerCase()
  const category = CATEGORIES.find((c) => categoryRaw.includes(c.id) || categoryRaw.includes(c.label.toLowerCase()))?.id
  const tags = find('тег', 'tags')
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter((t) => t && t !== '_Нет ответа_')
  const description = find('описан', 'текст', 'сообщен', 'description')
  const clean = description && description !== '_Нет ответа_' ? description : body
  return { meta: { category: category || DEFAULT_CATEGORY, tags: tags.slice(0, 4) }, clean }
}

function labelNames(issue: GhIssue): string[] {
  return (issue.labels || [])
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter(Boolean)
    .map((n) => n.trim().toLowerCase())
}

export function detectCategory(meta: ForumMeta, issue: GhIssue): string {
  if (meta.category && CATEGORIES.some((c) => c.id === meta.category)) return meta.category
  const fromLabels = labelNames(issue).find((name) =>
    CATEGORIES.some((c) => c.id === name || c.label.toLowerCase() === name || name === `cat:${c.id}`),
  )
  if (fromLabels) {
    return CATEGORIES.find((c) => c.id === fromLabels || c.label.toLowerCase() === fromLabels)!.id
  }
  return DEFAULT_CATEGORY
}

export function isForumPost(issue: GhIssue, owner: string): boolean {
  if (issue.pull_request) return false
  const body = issue.body || ''
  if (META_RE.test(body)) return true
  if (/^###\s+/m.test(body) && /категор|раздел|category/i.test(body)) return true
  // issue, созданный вручную владельцем репозитория, тоже считаем постом
  const labels = labelNames(issue)
  if (labels.includes('forum') || labels.some((l) => CATEGORIES.some((c) => c.id === l))) return true
  return issue.user?.login?.toLowerCase() === owner.toLowerCase()
}

export function authorOf(user: GhIssue['user']): Author {
  return {
    login: user?.login || 'unknown',
    avatar: user?.avatar_url || '',
    url: user?.html_url || `https://github.com/${user?.login || ''}`,
  }
}

export function issueToThread(issue: GhIssue): Thread {
  const metaFirst = parseMeta(issue.body || '')
  const formParsed = metaFirst.meta.category ? metaFirst : parseIssueForm(metaFirst.clean)
  const meta = { ...formParsed.meta, ...metaFirst.meta }
  const body = formParsed.clean
  return {
    number: issue.number,
    title: issue.title,
    body,
    excerpt: toPlainText(body, 220),
    author: authorOf(issue.user),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    comments: issue.comments || 0,
    likes: issue.reactions?.['+1'] ?? issue.reactions?.total_count ?? 0,
    likedByMe: false,
    category: detectCategory(metaFirst.meta, issue),
    tags: (metaFirst.meta.tags || formParsed.meta.tags || []).slice(0, 6),
    state: issue.state,
    htmlUrl: issue.html_url,
    hasImages: /!\[[^\]]*\]\([^)]+\)/.test(body),
    pinned: labelNames(issue).some((l) => ['pinned', 'pin', 'важное', 'закреплено', 'announcement'].includes(l)),
  }
}

export function commentToThread(comment: GhComment): ThreadComment {
  return {
    id: comment.id,
    body: parseMeta(comment.body || '').clean,
    author: authorOf(comment.user),
    createdAt: comment.created_at,
    htmlUrl: comment.html_url,
    likes: comment.reactions?.['+1'] ?? 0,
  }
}

/* ------------------------------------------------------------------ */
/* Ссылки на GitHub-формы (нужны, когда нет прав на запись)           */
/* ------------------------------------------------------------------ */

/** Прямая ссылка на создание issue — работает для любого GitHub-аккаунта. */
export function githubNewIssueUrl(owner: string, repo: string, input?: Partial<NewThreadInput>): string {
  const base = `https://github.com/${owner}/${repo}/issues/new`
  const params = new URLSearchParams()
  if (input?.title) params.set('title', input.title.slice(0, 250))
  if (input?.body) params.set('body', input.body.slice(0, 6000))
  const labels = ['forum', input?.category || DEFAULT_CATEGORY, ...(input?.tags || [])].filter(Boolean).join(',')
  params.set('labels', labels.slice(0, 200))
  const q = params.toString()
  return q ? `${base}?${q}` : base
}

export function githubReplyUrl(threadHtmlUrl: string): string {
  return threadHtmlUrl
}
