import { useEffect, useMemo, useState } from 'react'
import type { Author } from '../lib/model'
import { renderMarkdown } from '../lib/markdown'
import { classNames, initials, plural, timeAgo } from '../lib/format'

/* ------------------------------- аватар ------------------------------- */

export function Avatar({ author, size = 40, className }: { author: Author; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }
  if (!author.avatar || broken) {
    return (
      <span className={classNames('avatar avatar--fallback', className)} style={style} aria-hidden="true">
        {initials(author.login)}
      </span>
    )
  }
  return (
    <img
      className={classNames('avatar', className)}
      style={style}
      src={author.avatar}
      alt={author.login}
      loading="lazy"
      onError={() => setBroken(true)}
      title={author.login}
    />
  )
}

/* ------------------------------ markdown ------------------------------ */

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  return <div className={classNames('markdown', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

/* -------------------------------- время ------------------------------- */

export function Time({ iso, exact = true }: { iso: string; exact?: boolean }) {
  const [, force] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => force((n) => n + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const title = exact ? new Date(iso).toLocaleString('ru-RU') : undefined
  return (
    <time dateTime={iso} title={title}>
      {timeAgo(iso)}
    </time>
  )
}

/* ------------------------------- элементы ----------------------------- */

export function Badge({
  children,
  color,
  soft = true,
  className,
}: {
  children: React.ReactNode
  color?: string
  soft?: boolean
  className?: string
}) {
  const style = color
    ? soft
      ? { color, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }
      : { background: color, borderColor: color, color: '#fff' }
    : undefined
  return (
    <span className={classNames('badge', className)} style={style}>
      {children}
    </span>
  )
}

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" style={{ width: size, height: size }} />
      {label ? <span className="spinner-label">{label}</span> : null}
    </span>
  )
}

export function SkeletonCard() {
  return (
    <article className="thread-card thread-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--avatar" />
      <div className="thread-card__body">
        <div className="skeleton skeleton--line" style={{ width: '55%' }} />
        <div className="skeleton skeleton--line" style={{ width: '90%' }} />
        <div className="skeleton skeleton--line" style={{ width: '70%' }} />
      </div>
    </article>
  )
}

export function EmptyState({ emoji = '🫥', title, text, action }: { emoji?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__emoji" aria-hidden="true">
        {emoji}
      </div>
      <h3 className="empty__title">{title}</h3>
      {text ? <p className="empty__text">{text}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty empty--error">
      <div className="empty__emoji" aria-hidden="true">
        ⚠️
      </div>
      <h3 className="empty__title">Не удалось загрузить</h3>
      <p className="empty__text">{message}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Попробовать снова
        </button>
      ) : null}
    </div>
  )
}

export function LikeButton({
  likes,
  liked,
  onToggle,
  size = 'md',
}: {
  likes: number
  liked: boolean
  onToggle: () => void
  size?: 'md' | 'sm'
}) {
  return (
    <button
      type="button"
      className={classNames('like', liked && 'is-liked', size === 'sm' && 'like--sm')}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={liked}
      title={liked ? 'Убрать реакцию' : 'Нравится'}
    >
      <svg viewBox="0 0 24 24" width={size === 'sm' ? 15 : 17} height={size === 'sm' ? 15 : 17} aria-hidden="true">
        <path
          d="M12 20.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 8.1a4.3 4.3 0 0 1 7.5 2.7c0 5.1-7.5 9.7-7.5 9.7Z"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      <span>{likes}</span>
    </button>
  )
}

export function CommentCount({ count }: { count: number }) {
  return (
    <span className="meta-item" title={`${count} ${plural(count, ['ответ', 'ответа', 'ответов'])}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M20 12.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.2-2.9-.5L5 20l1-3.2A6.4 6.4 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {count}
    </span>
  )
}

export function Icon({ name, size = 18 }: { name: 'search' | 'plus' | 'gear' | 'sun' | 'moon' | 'menu' | 'close' | 'external' | 'user' | 'logout' | 'github' | 'check' | 'copy' | 'arrow-left'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.6-1.1H1.2a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 3 8.8a1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4H7.5A1.7 1.7 0 0 0 8.6 3V2.8a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'external':
      return (
        <svg {...common}>
          <path d="M14 4h6v6M20 4l-8.5 8.5" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c1-3.4 3.7-5 7-5s6 1.6 7 5" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M15 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9" />
          <path d="M18 12H10m8 0-3-3m3 3-3 3" />
        </svg>
      )
    case 'github':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.5 2.9 8.4 6.8 9.7.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.4-3.4-1.4-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.3 1.1 2.9.9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5.1 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 4-2.4 4.8-4.6 5.1.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.3 10.3 0 0 0 22 12.3C22 6.6 17.5 2 12 2Z" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 13 4.5 4.5L19 7" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M15 6.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1.5" />
        </svg>
      )
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
        </svg>
      )
    default:
      return null
  }
}

export function CopyButton({ value, label = 'Копировать' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          window.setTimeout(() => setDone(false), 1800)
        } catch {
          /* нет доступа к буферу обмена */
        }
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={15} />
      {done ? 'Скопировано' : label}
    </button>
  )
}
