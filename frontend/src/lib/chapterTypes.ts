import {
  ClipboardList,
  FileText,
  GraduationCap,
  Headphones,
  HelpCircle,
  Layers,
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
  "mixed",
] as const

export type ChapterType = (typeof CHAPTER_TYPES)[number]

type ChapterTypeMeta = {
  label: string
  description: string
  icon: LucideIcon
  /** Tailwind pill classes (editorial: muted surface, neutral text). */
  color: string
  /** Compact badge variant — same editorial treatment as ``color``. */
  badgeColor: string
  /** Icon used in the teacher editor grid when ``icon`` feels too literal. */
  editorIcon?: LucideIcon
}

// Editorial palette: chapter type is communicated through label + icon, not
// colour. Using a single muted token keeps the UI calm and consistent across
// light/dark and matches the rest of the token-based design system.
const PILL = "bg-muted text-muted-foreground"

export const CHAPTER_TYPE_META: Record<ChapterType, ChapterTypeMeta> = {
  reading: {
    label: "Reading",
    description: "Text lesson with rich formatting",
    icon: FileText,
    color: PILL,
    badgeColor: PILL,
  },
  video: {
    label: "Video",
    description: "Video lesson with optional notes",
    icon: PlayCircle,
    color: PILL,
    badgeColor: PILL,
  },
  audio: {
    label: "Audio",
    description: "Audio lesson with transcript",
    icon: Headphones,
    color: PILL,
    badgeColor: PILL,
  },
  quiz: {
    label: "Quiz",
    description: "Test student knowledge",
    icon: HelpCircle,
    color: PILL,
    badgeColor: PILL,
  },
  exam: {
    label: "Exam",
    description: "Final assessment with attempts limit",
    icon: GraduationCap,
    color: PILL,
    badgeColor: PILL,
  },
  assignment: {
    label: "Assignment",
    description: "Submit work for grading",
    icon: ClipboardList,
    color: PILL,
    badgeColor: PILL,
  },
  mixed: {
    label: "Mixed",
    description: "Combine multiple content types",
    icon: Layers,
    color: PILL,
    badgeColor: PILL,
    editorIcon: Puzzle,
  },
}

/** Chapter types whose completion gates the next chapter when ``is_locked`` is on. */
const GRADABLE_CHAPTER_TYPES: ReadonlySet<ChapterType> = new Set([
  "quiz",
  "exam",
  "assignment",
])

/** Chapter types that render freeform ``ChapterBlock`` rows as their body. */
export const BLOCK_BASED_CHAPTER_TYPES: ReadonlySet<ChapterType> = new Set([
  "reading",
  "video",
  "audio",
  "mixed",
])

const LEGACY_ALIASES: Record<string, ChapterType> = {
  content: "reading",
  // The discussion feature was removed in favour of plain reading with a
  // prompt — existing rows still migrate on the server, but any late reads
  // coming back with the old value normalise to reading here.
  discussion: "reading",
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
