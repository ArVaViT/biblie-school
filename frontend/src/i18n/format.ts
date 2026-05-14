/**
 * Date / time formatting helpers.
 *
 * # The contract (one canonical format for technical timestamps)
 *
 * Every date the user sees as a technical timestamp — table cells,
 * audit logs, last-activity columns, "joined on", "created at",
 * "submitted at" — is rendered in **ISO-8601 form, in the browser's
 * local timezone**:
 *
 *   * `formatDate(d)`        → `YYYY-MM-DD`
 *   * `formatDateTime(d)`    → `YYYY-MM-DD HH:mm:ss`
 *   * `formatDateTimeMs(d)`  → `YYYY-MM-DD HH:mm:ss.SSS`
 *
 * Two consequences are deliberate:
 *
 *   1. The string is **identical across locales**. EN and RU users see
 *      the same characters. Unambiguous, sortable, no day/month
 *      confusion across the en-US / ru-RU split.
 *   2. The wall-clock time is **the browser's local zone**, not UTC.
 *      Backend writes are always UTC; the moment they cross to the
 *      client, JS's ``getFullYear()`` / ``getHours()`` etc. project
 *      them into whatever zone the browser is in. A timezone selector
 *      may ship later; until then, browser zone is the answer.
 *
 * # The escape hatch (for editorial / ceremonial copy only)
 *
 *   * `formatDateLong(d, options?)` — locale-aware long form via
 *      ``Intl.DateTimeFormat``. Use it for things that read as
 *      *prose*: certificate body text, marketing hero copy, the day
 *      header on the calendar. Do NOT use it for table cells or audit
 *      logs — visual consistency across locales matters more than
 *      "Mon, May 14" reading naturally for an English user.
 *
 * If you find yourself reaching for `formatDateLong` outside an
 * editorial context, you probably want `formatDate` instead.
 */
import i18n from "./config"

function pad(value: number, width = 2): string {
  return value.toString().padStart(width, "0")
}

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Canonical date: ``YYYY-MM-DD`` in the browser's local timezone. */
export function formatDate(date: Date | string | number | null | undefined): string {
  if (date == null) return ""
  const d = toDate(date)
  if (!d) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Canonical date + time: ``YYYY-MM-DD HH:mm:ss``. */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (date == null) return ""
  const d = toDate(date)
  if (!d) return ""
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/**
 * Canonical date + time with millisecond precision:
 * ``YYYY-MM-DD HH:mm:ss.SSS``. Reach for this only when sub-second
 * resolution actually matters (audit forensics, latency dashboards);
 * for normal UI ``formatDateTime`` reads cleaner.
 */
export function formatDateTimeMs(date: Date | string | number | null | undefined): string {
  if (date == null) return ""
  const d = toDate(date)
  if (!d) return ""
  return `${formatDateTime(d)}.${pad(d.getMilliseconds(), 3)}`
}

/**
 * Locale-aware long form (``Intl.DateTimeFormat``). EN and RU render
 * different strings on purpose — this is the editorial / ceremonial
 * format. Use it for prose: certificate body, calendar day header,
 * "joined on…" lines, time-stamped deadlines where natural language
 * is warranted.
 *
 * Defaults to ``{ year: "numeric", month: "long", day: "numeric" }``
 * which yields ``May 14, 2026`` / ``14 мая 2026 г.``. Supply hour /
 * minute / weekday options to extend — backed by ``toLocaleString``
 * so the same call handles date-only and date+time outputs.
 */
export function formatDateLong(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (date == null) return ""
  const d = toDate(date)
  if (!d) return ""
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase()
  const locale = lang.startsWith("ru") ? "ru-RU" : "en-US"
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  })
}
