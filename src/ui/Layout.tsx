import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useUI } from './context'
import { useTheme } from './theme'
import { Avatar, Icon } from './components'
import { CATEGORIES } from '../config'
import { classNames } from '../lib/format'

function UserMenu() {
  const { session, signOut } = useStore()
  const { openSignIn, openSettings, toast } = useUI()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  if (!session.user) {
    return (
      <button type="button" className="btn btn--ghost" onClick={openSignIn}>
        <Icon name="user" size={17} />
        <span className="hide-sm">Войти</span>
      </button>
    )
  }

  return (
    <div className="usermenu" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="usermenu__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Avatar author={{ login: session.user.login, avatar: session.user.avatar_url, url: session.user.html_url }} size={32} />
        <span className="hide-sm">{session.user.login}</span>
      </button>
      {open ? (
        <div className="usermenu__panel" role="menu">
          <Link className="usermenu__item" to={`/u/${session.user.login}`} onClick={() => setOpen(false)}>
            <Icon name="user" size={16} /> Мои темы
          </Link>
          <a
            className="usermenu__item"
            href={session.user.html_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <Icon name="github" size={16} /> Профиль на GitHub
          </a>
          <button type="button" className="usermenu__item" onClick={() => { setOpen(false); openSettings() }}>
            <Icon name="gear" size={16} /> Настройки
          </button>
          <button
            type="button"
            className="usermenu__item usermenu__item--danger"
            onClick={() => {
              setOpen(false)
              signOut()
              toast('Вы вышли из аккаунта')
            }}
          >
            <Icon name="logout" size={16} /> Выйти
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { config, isDemo, repoInfo, session } = useStore()
  const { openSettings, openSignIn } = useUI()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
    setMobileOpen(false)
  }

  return (
    <div className="app">
      <div className="announce" role="note">
        <span className="announce__dot" />
        {session.user
          ? <>Вы вошли как <b>@{session.user.login}</b>{session.canWrite ? ' — можно писать прямо с сайта.' : ' — публикация через форму GitHub.'}</>
          : <>Форум на GitHub Pages. Войдите, чтобы писать от своего имени.</>}
        {!session.user ? (
          <button type="button" className="btn btn--xs btn--primary" onClick={openSignIn}>
            Войти
          </button>
        ) : null}
      </div>

      <header className="header">
        <div className="header__inner container">
          <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
            <span className="brand__mark" aria-hidden="true">
              {config.title.slice(0, 1).toUpperCase()}
            </span>
            <span className="brand__text">
              <b>{config.title}</b>
              <small>{config.tagline}</small>
            </span>
          </Link>

          <nav className="nav">
            <NavLink to="/" className={({ isActive }) => classNames('nav__link', isActive && 'is-active')} end>
              Обсуждения
            </NavLink>
            <NavLink to="/members" className={({ isActive }) => classNames('nav__link', isActive && 'is-active')}>
              Участники
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => classNames('nav__link', isActive && 'is-active')}>
              О форуме
            </NavLink>
          </nav>

          <form className="search search--head" onSubmit={submitSearch} role="search">
            <Icon name="search" size={16} />
            <input
              className="search__input"
              type="search"
              placeholder="Поиск по темам…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          <div className="header__actions">
            <button type="button" className="icon-btn" onClick={toggle} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button type="button" className="icon-btn hide-sm" onClick={openSettings} title="Настройки">
              <Icon name="gear" />
            </button>
            <UserMenu />
            <Link className="btn btn--primary hide-sm" to="/new">
              <Icon name="plus" size={17} /> Новая тема
            </Link>
            <button type="button" className="icon-btn show-sm" onClick={() => setMobileOpen((v) => !v)} aria-label="Меню">
              <Icon name={mobileOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="mobile-panel container">
            <form className="search" onSubmit={submitSearch} role="search">
              <Icon name="search" size={16} />
              <input className="search__input" type="search" placeholder="Поиск…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </form>
            <div className="mobile-panel__links">
              <Link to="/" onClick={() => setMobileOpen(false)}>Обсуждения</Link>
              <Link to="/members" onClick={() => setMobileOpen(false)}>Участники</Link>
              <Link to="/about" onClick={() => setMobileOpen(false)}>О форуме</Link>
              <button type="button" onClick={() => { setMobileOpen(false); openSettings() }}>Настройки</button>
            </div>
            <div className="mobile-panel__cats">
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={`/c/${c.id}`} className="chip" onClick={() => setMobileOpen(false)}>
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </Link>
              ))}
            </div>
            <Link className="btn btn--primary btn--block" to="/new" onClick={() => setMobileOpen(false)}>
              <Icon name="plus" size={17} /> Новая тема
            </Link>
          </div>
        ) : null}
      </header>

      {isDemo ? (
        <div className="demo-banner container">
          <span>🧪 Демо-режим: посты хранятся только в этом браузере.</span>
          <button type="button" className="btn btn--xs" onClick={openSettings}>
            Подключить GitHub
          </button>
        </div>
      ) : null}

      <main className="main container">{children}</main>

      <footer className="footer">
        <div className="container footer__inner">
          <div>
            <b>{config.title}</b>
            <span className="muted"> · {isDemo ? 'демо-режим' : `${config.owner}/${config.repo}`}</span>
          </div>
          <nav className="footer__links">
            <Link to="/about">О форуме</Link>
            <Link to="/about#rules">Правила</Link>
            <a href={`https://github.com/${config.owner}/${config.repo}`} target="_blank" rel="noopener noreferrer">
              GitHub {repoInfo ? `★ ${repoInfo.stargazers_count}` : ''}
            </a>
          </nav>
          <div className="muted xsmall">Данные: GitHub Issues · Хостинг: GitHub Pages</div>
        </div>
      </footer>
    </div>
  )
}
