import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.hot) {
  const recoveryKey = 'urdf-builder-hmr-renderer-recovery'
  const hookCrashPatterns = [
    'React has detected a change in the order of Hooks',
    "Cannot read properties of null (reading 'getSnapshot')",
  ]
  const recoverFromHookCrash = (message: string) => {
    if (!hookCrashPatterns.some((pattern) => message.includes(pattern))) {
      return
    }

    if (window.sessionStorage.getItem(recoveryKey)) {
      return
    }

    window.sessionStorage.setItem(recoveryKey, '1')
    window.location.reload()
  }

  window.setTimeout(() => window.sessionStorage.removeItem(recoveryKey), 1500)
  window.addEventListener('error', (event) => {
    recoverFromHookCrash(`${event.message} ${event.error instanceof Error ? event.error.message : ''}`)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    recoverFromHookCrash(reason instanceof Error ? reason.message : String(reason))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
