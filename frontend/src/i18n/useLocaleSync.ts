import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/context/useAuth"

import { LOCALE_STORAGE_KEY, isSupportedLocale } from "./config"

/**
 * Keep i18next, localStorage, and the authenticated profile in lockstep.
 *
 * - On login: profile.preferred_locale wins. We update i18n and persist
 *   the choice to localStorage so a refresh picks the same value before
 *   the auth context has a chance to load.
 * - For guests: we leave i18next's detector alone (browser → localStorage
 *   fallback already runs at init time).
 *
 * Mounted once in `App` near the auth provider.
 */
export function useLocaleSync(): void {
  const { user } = useAuth()
  const { i18n } = useTranslation()

  useEffect(() => {
    if (!user) return
    const desired = user.preferred_locale
    if (!isSupportedLocale(desired)) return
    if (i18n.language === desired) return
    void i18n.changeLanguage(desired)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, desired)
    } catch {
      // Storage can throw in privacy mode or quota-exceeded scenarios.
      // The change still takes effect for the current session.
    }
  }, [user, i18n])
}
