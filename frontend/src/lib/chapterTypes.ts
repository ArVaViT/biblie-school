import {
  ClipboardList,
  FileText,
  GraduationCap,
  Headphones,
  HelpCircle,
  Layers,
  MessageSquare,
  PlayCircle,
  Puzzle,
  type LucideIcon,
} from "lucide-react"

/**
 * Single source of truth for the user-facing chapter types. The backend mirror
 * lives at ``backend/app/schemas/course.py`` (``CHAPTER_TYPES`` literal); if you
 * add a type, update both sides *and* the Postgres ``chapters_chapter_type_check``
 * constraint.
 *
 * ``"content"`` exists in the database as a legacy alias for ``"reading"`` and is
 * intentionally omitted from this tuple — it should never be produced by the UI
 * and is normalised to ``"reading"`` on read via ``normalizeChapterType``.
 */
export const CHAPTER_TYPES = [
  "reading",
  "video",
  "audio",
  "quiz",
  "exam",
  "assignment",
  "discussion",
  "mixed",
] as const

export type ChapterType = (typeof CHAPTER_TYPES)[number]

type ChapterTypeMeta = {
  label: string
  description: string
  icon: LucideIcon
  /** Full Tailwind pill colour string (bg+text, light+dark). */
  color: string
  /** Slightly heavier background variant used in compact list badges. */
  badgeColor: string
  /** Icon used in the teacher editor grid when ``icon`` feels too literal. */
  editorIcon?: LucideIcon
}

export const CHAPTER_TYPE_META: Record<ChapterType, ChapterTypeMeta> = {
  reading: {
    label: "Reading",
    description: "Text lesson with rich formatting",
    icon: FileText,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  video: {
    label: "Video",
    description: "Video lesson with optional notes",
    icon: PlayCircle,
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  },
  audio: {
    label: "Audio",
    description: "Audio lesson with transcript",
    icon: Headphones,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  },
  quiz: {
    label: "Quiz",
    description: "Test student knowledge",
    icon: HelpCircle,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  exam: {
    label: "Exam",
    description: "Final assessment with attempts limit",
    icon: GraduationCap,
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
  assignment: {
    label: "Assignment",
    description: "Submit work for grading",
    icon: ClipboardList,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  },
  discussion: {
    label: "Discussion",
    description: "Student discussion prompt",
    icon: MessageSquare,
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  },
  mixed: {
    label: "Mixed",
    description: "Combine multiple content types",
    icon: Layers,
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    editorIcon: Puzzle,
  },
}

/** Chapter types whose completion gates the next chapter when ``is_locked`` is on. */
export const GRADABLE_CHAPTER_TYPES: ReadonlySet<ChapterType> = new Set([
  "quiz",
  "exam",
  "assignment",
])

/** Chapter types that render freeform ``ChapterBlock`` rows as their body. */
export const BLOCK_BASED_CHAPTER_TYPES: ReadonlySet<ChapterType> = new Set([
  "reading",
  "video",
  "audio",
  "discussion",
  "mixed",
])

const LEGACY_ALIASES: Record<string, ChapterType> = {
  content: "reading",
}

/**
 * Coerce any string coming from the API to a known ``ChapterType``. Falls back
 * to ``"reading"`` for anything unrecognised so the UI always has something to
 * render.
 */
export function normalizeChapterType(raw: string | null | undefined): ChapterType {
  if (!raw) return "reading"
  if ((CHAPTER_TYPES as readonly string[]).includes(raw)) return raw as ChapterType
  return LEGACY_ALIASES[raw] ?? "reading"
}

export function getChapterTypeMeta(raw: string | null | undefined): ChapterTypeMeta {
  return CHAPTER_TYPE_META[normalizeChapterType(raw)]
}

export function isGradableChapterType(raw: string | null | undefined): boolean {
  return GRADABLE_CHAPTER_TYPES.has(normalizeChapterType(raw))
}
