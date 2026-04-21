import { z } from "zod"

/**
 * Frontend validation schemas. Ranges intentionally mirror the Pydantic
 * schemas in ``backend/app/schemas/course.py`` so invalid input fails fast
 * client-side before we hit the server.
 */

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""))

// Kept in sync with backend/app/schemas/course.py CHAPTER_TYPES and
// frontend/src/types/index.ts ChapterType. Used by Zod to validate form input.
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

export const courseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(300, "Title must be 300 characters or fewer"),
  description: optionalString(10_000),
  image_url: optionalString(2048),
})

export const moduleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(300, "Title must be 300 characters or fewer"),
  description: optionalString(5_000),
  order_index: z.number().int().min(0).default(0),
  due_date: z.string().datetime().nullable().optional(),
})

export const chapterSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(300, "Title must be 300 characters or fewer"),
  content: optionalString(500_000),
  video_url: optionalString(2048),
  order_index: z.number().int().min(0).default(0),
  chapter_type: z.enum(CHAPTER_TYPES).default("reading"),
  requires_completion: z.boolean().default(false),
  is_locked: z.boolean().default(false),
})

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100),
})

export type CourseFormData = z.infer<typeof courseSchema>
export type ModuleFormData = z.infer<typeof moduleSchema>
export type ChapterFormData = z.infer<typeof chapterSchema>
export type ProfileFormData = z.infer<typeof profileSchema>
