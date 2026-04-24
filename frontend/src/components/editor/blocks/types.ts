import {
  ClipboardList,
  FileText,
  HelpCircle,
  Paperclip,
  Type,
  type LucideIcon,
} from "lucide-react"

/**
 * The block "kinds" a teacher can add to a chapter. Video and audio
 * embeds live inside text blocks (the rich editor's toolbar has
 * dedicated buttons), so the block layer only needs the shapes that
 * aren't just HTML.
 */
export const BLOCK_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "quiz", label: "Quiz", icon: HelpCircle },
  { value: "assignment", label: "Assignment", icon: ClipboardList },
  { value: "file", label: "File", icon: Paperclip },
] as const satisfies ReadonlyArray<{ value: string; label: string; icon: LucideIcon }>

export type BlockType = (typeof BLOCK_TYPES)[number]["value"]

export function blockIcon(type: string): LucideIcon {
  return BLOCK_TYPES.find((bt) => bt.value === type)?.icon ?? FileText
}

export function blockLabel(type: string): string {
  return BLOCK_TYPES.find((bt) => bt.value === type)?.label ?? type
}
