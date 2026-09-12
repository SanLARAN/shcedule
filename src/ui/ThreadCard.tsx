import { Link } from 'react-router-dom'
import type { Thread } from '../lib/model'
import { getCategory } from '../config'
import { Avatar, Badge, CommentCount, Icon, LikeButton, Time } from './components'
import { classNames } from '../lib/format'

export function ThreadCard({
  thread,
  onLike,
  showCategory = true,
  pinned = false,
}: {
  thread: Thread
  onLike?: (thread: Thread, liked: boolean) => void
  showCategory?: boolean
  pinned?: boolean
}) {
  const cat = getCategory(thread.category)
  return (
    <article className={classNames('thread-card', pinned && 'thread-card--pinned')}>
      <Link to={`/u/${thread.author.login}`} className="thread-card__avatar" tabIndex={-1} aria-hidden="true">
        <Avatar author={thread.author} size={44} />
      </Link>

      <div className="thread-card__body">
        <div className="thread-card__top">
          {pinned ? <span className="pin">📌 закреплено</span> : null}
          {showCategory ? (
            <Link to={`/c/${cat.id}`} className="cat-link" style={{ color: cat.color }}>
              <span aria-hidden="true">{cat.emoji}</span> {cat.label}
            </Link>
          ) : null}
          {thread.state === 'closed' ? <Badge className="badge--muted">закрыто</Badge> : null}
        </div>

        <h3 className="thread-card__title">
          <Link to={`/t/${thread.number}`}>{thread.title}</Link>
        </h3>

        {thread.excerpt ? <p className="thread-card__excerpt">{thread.excerpt}</p> : null}

        <div className="thread-card__meta">
          <Link className="meta-author" to={`/u/${thread.author.login}`}>
            @{thread.author.login}
          </Link>
          <span className="dot" />
          <span className="meta-item">
            <Time iso={thread.createdAt} />
          </span>
          <span className="dot" />
          <CommentCount count={thread.comments} />
          {thread.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} className="badge--tag">
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="thread-card__side">
        <LikeButton likes={thread.likes} liked={thread.likedByMe} onToggle={() => onLike?.(thread, !thread.likedByMe)} size="sm" />
        <Link className="thread-card__open" to={`/t/${thread.number}`} aria-label="Открыть тему">
          <Icon name="external" size={16} />
        </Link>
      </div>
    </article>
  )
}

export function ThreadRow({ thread }: { thread: Thread }) {
  const cat = getCategory(thread.category)
  return (
    <li className="thread-row">
      <Link to={`/t/${thread.number}`}>
        <span className="thread-row__cat" style={{ background: cat.color }} aria-hidden="true" />
        <span className="thread-row__title">{thread.title}</span>
        <span className="thread-row__meta">
          <CommentCount count={thread.comments} />
        </span>
      </Link>
    </li>
  )
}
