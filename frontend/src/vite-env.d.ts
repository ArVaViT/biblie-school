/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_DATADOG_APPLICATION_ID?: string
  readonly VITE_DATADOG_CLIENT_TOKEN?: string
  readonly VITE_DATADOG_SITE?: string
  readonly VITE_DATADOG_SERVICE?: string
  readonly VITE_DATADOG_ENV?: string
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

