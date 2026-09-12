export type GhUser = {
  login: string
  name?: string | null
  avatar_url: string
  html_url: string
  bio?: string | null
}

export type GhLabel = {
  id: number
  name: string
  color: string
}

export type GhIssue = {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  created_at: string
  updated_at: string
  comments: number
  html_url: string
  user: GhUser
  labels: (GhLabel | string)[]
  pull_request?: unknown
  reactions?: { total_count: number; '+1': number; '-1': number }
  /** Присутствует, если issue закреплён (не всегда отдаётся API) */
  pinned?: boolean
}

export type GhComment = {
  id: number
  body: string
  created_at: string
  updated_at: string
  html_url: string
  user: GhUser
  reactions?: { total_count: number; '+1': number; '-1': number }
}

export type GhReaction = {
  id: number
  content: string
  user: GhUser
}

export type { ForumConfig, Category } from '../config'
