import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { StoreProvider } from './lib/store'
import { UIProvider } from './ui/context'
import './styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('Не найден #root')

createRoot(container).render(
  <StrictMode>
    <StoreProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </StoreProvider>
  </StrictMode>,
)
