import { z } from "zod"

export const courseSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
})

export const moduleSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  order_index: z.number().int().min(0).default(0),
})

export const chapterSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  content: z.string().max(50000).optional().or(z.literal("")),
  order_index: z.number().int().min(0).default(0),
})

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
})

export type CourseFormData = z.infer<typeof courseSchema>
export type ModuleFormData = z.infer<typeof moduleSchema>
export type ChapterFormData = z.infer<typeof chapterSchema>
export type ProfileFormData = z.infer<typeof profileSchema>
