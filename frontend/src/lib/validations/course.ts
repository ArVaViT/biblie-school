import { z } from "zod"

import { CHAPTER_TYPES as CANONICAL_CHAPTER_TYPES } from "@/lib/chapterTypes"

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

// Re-exported from ``@/lib/chapterTypes`` so the Zod schema and the runtime
// metadata never drift out of sync. Mirrors ``backend/app/schemas/course.py``.
export const CHAPTER_TYPES = CANONICAL_CHAPTER_TYPES

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
