import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/useAuth"
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from "@/i18n/config"
import { preferencesService } from "@/services/preferences"

interface LanguageSwitcherProps {
  /**
   * `compact` renders just the globe + a 2-letter chip — fits in the header
   * footprint. The default `full` variant shows full button labels and is
   * meant for the profile preferences card.
   */
  variant?: "compact" | "full"
}

const LABELS: Record<SupportedLocale, { native: string; short: string }> = {
  ru: { native: "Русский", short: "RU" },
  en: { native: "English", short: "EN" },
}

export default function LanguageSwitcher({ variant = "full" }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [pending, setPending] = useState<SupportedLocale | null>(null)

  const active: SupportedLocale = isSupportedLocale(i18n.language) ? i18n.language : "ru"

  const switchTo = async (locale: SupportedLocale) => {
    if (locale === active || pending) return
    setPending(locale)
    try {
      // Flip i18n + storage immediately so the UI never lags behind a click.
      // The API call below catches up in the background; if it fails the
      // local choice still stands until the next login.
      await i18n.changeLanguage(locale)
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
      } catch {
        // Storage may be unavailable; UI already reflects the change.
      }
      if (user) {
        await preferencesService.setPreferredLocale(locale).catch(() => {
          // Network failure should not roll back the local switch — the user
          // already sees the new language. The next successful save will
          // sync server-side.
        })
        await refreshUser()
      }
    } finally {
      setPending(null)
    }
  }

  if (variant === "compact") {
    const next: SupportedLocale = active === "ru" ? "en" : "ru"
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => switchTo(next)}
        disabled={pending !== null}
        aria-label={t("language.switchTo", { language: LABELS[next].native })}
        title={t("language.switchTo", { language: LABELS[next].native })}
      >
        <Globe className="h-4 w-4" />
        <span className="sr-only">{LABELS[next].short}</span>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={t("language.label")}>
      {SUPPORTED_LOCALES.map((locale) => (
        <Button
          key={locale}
          variant={locale === active ? "secondary" : "outline"}
          size="sm"
          role="radio"
          aria-checked={locale === active}
          onClick={() => switchTo(locale)}
          disabled={pending !== null}
        >
          {LABELS[locale].native}
        </Button>
      ))}
    </div>
  )
}
