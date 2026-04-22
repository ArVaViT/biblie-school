import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'
import { initDatadogRum } from './lib/datadog'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/fraunces/index.css'
import './index.css'

// Initialize monitoring before React mounts so early boot errors
// (bad env vars, missing #root, etc.) get captured. Both calls are
// no-ops when their respective env vars are unset, which is the case
// for local dev and previews without monitoring credentials.
initSentry()
initDatadogRum()

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

