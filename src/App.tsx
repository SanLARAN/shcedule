import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './ui/Layout'
import { useUI } from './ui/context'
import { SignInModal } from './ui/SignInModal'
import { SettingsModal } from './ui/SettingsModal'
import { GithubWriteModal } from './ui/GithubWriteModal'
import { Toaster } from './ui/Toaster'
import { HomePage } from './pages/HomePage'
import { ThreadPage } from './pages/ThreadPage'
import { NewThreadPage } from './pages/NewThreadPage'
import { AboutPage, CategoryPage, MembersPage, NotFoundPage, UserPage } from './pages/StaticPages'

function ScrollToTop() {
  const location = useLocation()
  useEffect(() => {
    // якорь #comments оставляем как есть, остальное — наверх
    if (!location.hash || location.hash.startsWith('#/')) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [location.pathname, location.search])
  return null
}

function Modals() {
  const { modal, closeModal } = useUI()
  if (!modal) return null
  if (modal.kind === 'signin') return <SignInModal onClose={closeModal} />
  if (modal.kind === 'settings') return <SettingsModal onClose={closeModal} />
  if (modal.kind === 'github-write') return <GithubWriteModal url={modal.url} title={modal.title} onClose={closeModal} />
  return null
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:id" element={<CategoryPage />} />
          <Route path="/t/:number" element={<ThreadPage />} />
          <Route path="/new" element={<NewThreadPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/u/:login" element={<UserPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
      <Modals />
      <Toaster />
    </HashRouter>
  )
}
