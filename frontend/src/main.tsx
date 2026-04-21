import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import './index.css'

// Initialize error monitoring before React mounts so early boot errors
// (bad env vars, missing #root, etc.) surface in Sentry. No-op when
// VITE_SENTRY_DSN is unset, which is the case for local dev and previews
// without monitoring env vars.
initSentry()

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found in DOM')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

