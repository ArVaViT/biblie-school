import { datadogRum } from "@datadog/browser-rum"
import { reactPlugin } from "@datadog/browser-rum-react"

// Datadog RUM is opt-in: if the applicationId / clientToken aren't set we
// skip init entirely so local and preview builds don't ship events to a
// dashboard nobody reads.
export function initDatadogRum() {
  const applicationId = import.meta.env.VITE_DATADOG_APPLICATION_ID
  const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN
  if (!applicationId || !clientToken) return

  const env = import.meta.env.VITE_DATADOG_ENV ?? import.meta.env.MODE
  const site = import.meta.env.VITE_DATADOG_SITE ?? "us5.datadoghq.com"
  const service = import.meta.env.VITE_DATADOG_SERVICE ?? "bible-school-frontend"
  const version = import.meta.env.VITE_APP_VERSION ?? "0.0.0"

  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service,
    env,
    version,
    // Record every session. Volume is tiny at our scale (~tens of users),
    // so paying a few cents for full coverage is worth more than sampling.
    sessionSampleRate: 100,
    // Session Replay is the expensive one — keep it at 20% of sessions,
    // matching Datadog's recommended starting point. Bump later if needed.
    sessionReplaySampleRate: 20,
    // Privacy: mask user input by default — quiz answers, student names,
    // and chat-style pages can leak PII through session replays.
    defaultPrivacyLevel: "mask-user-input",
    trackResources: true,
    trackUserInteractions: true,
    trackLongTasks: true,
    plugins: [reactPlugin({ router: false })],
  })
}
