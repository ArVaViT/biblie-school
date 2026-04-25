"""Locale primitives shared across schemas, services, and the translation
pipeline.

Adding a new language is a three-step change:
    1. Append the code to ``LOCALE_CODES`` and the ``LocaleCode`` literal.
    2. Update the ``CHECK`` constraints in the related Supabase migrations
       (``profiles.preferred_locale``, ``courses.source_locale``,
       ``content_translations.locale``).
    3. Ship a frontend bundle (``frontend/src/i18n/locales/<code>.json``)
       and add it to ``i18n.ts``.
"""

from __future__ import annotations

from typing import Final, Literal, cast

LocaleCode = Literal["ru", "en"]

LOCALE_CODES: Final[tuple[LocaleCode, ...]] = ("ru", "en")
DEFAULT_LOCALE: Final[LocaleCode] = "ru"


def normalize_locale(value: str | None, *, fallback: LocaleCode = DEFAULT_LOCALE) -> LocaleCode:
    """Coerce arbitrary input to a supported locale.

    Accepts BCP-47-ish strings (``ru-RU``, ``en_US``) and degrades gracefully
    to ``fallback`` when the language is unsupported. Used both at API edges
    (Accept-Language header) and inside the translation pipeline.
    """
    if not value:
        return fallback
    head = value.replace("_", "-").split("-", 1)[0].strip().lower()
    if head in LOCALE_CODES:
        # ``head`` is a runtime ``str`` that we just verified is a valid
        # ``LocaleCode``; some mypy versions narrow this automatically and
        # some don't, so use an explicit cast to be portable.
        return cast("LocaleCode", head)
    return fallback
