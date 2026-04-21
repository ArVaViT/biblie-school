import * as Sentry from "@sentry/react"

// Sentry is opt-in: if VITE_SENTRY_DSN isn't set, we skip init entirely so
// local / preview builds don't ship event payloads nobody will read. Same
// pattern as the backend (see app/main.py).
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE

  Sentry.init({
    dsn,
    environment,
    // Performance traces: 10% in prod keeps volume well within the free tier
    // while still giving us distribution samples for route-level latency.
    // Preview deploys get a higher rate so we can spot regressions before
    // they reach production.
    tracesSampleRate: environment === "production" ? 0.1 : 0.5,
    // Session Replay: record 10% of normal sessions and 100% of sessions
    // that actually contained an error. This is the Sentry-recommended mix
    // for catching bugs without paying for idle tabs.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask inputs/text by default — student records, quiz content, and
        // chat-style pages can leak PII otherwise.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    // Strip noisy "script error" / extension noise that isn't actionable.
    ignoreErrors: [
      "ResizeObserver loop completed",
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
  })
}
