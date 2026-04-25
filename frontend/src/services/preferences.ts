import api from "./api"
import type { SupportedLocale } from "@/i18n/config"
import type { User } from "@/types"

/**
 * Persist user preferences server-side.
 *
 * Wraps the FastAPI `PATCH /users/me/preferences` endpoint. Returns the
 * refreshed user profile so the caller can update its local cache without a
 * second round-trip.
 */
export const preferencesService = {
  async setPreferredLocale(locale: SupportedLocale): Promise<User> {
    const { data } = await api.patch<User>("/users/me/preferences", {
      preferred_locale: locale,
    })
    return data
  },
}
