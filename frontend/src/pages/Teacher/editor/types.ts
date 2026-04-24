export interface MaterialFile {
  name: string
  path: string
  size?: number
}

export interface CohortFormState {
  name: string
  start_date: string
  end_date: string
  enrollment_start: string
  enrollment_end: string
  max_students: string
}

export interface EventFormState {
  title: string
  description: string
  event_type: string
  event_date: string
}

export const EMPTY_COHORT_FORM: CohortFormState = {
  name: "",
  start_date: "",
  end_date: "",
  enrollment_start: "",
  enrollment_end: "",
  max_students: "",
}

export const EMPTY_EVENT_FORM: EventFormState = {
  title: "",
  description: "",
  event_type: "other",
  event_date: "",
}

export type CourseEditorModal =
  | "enroll"
  | "announce"
  | "materials"
  | "cohorts"
  | "events"
  | null

/**
 * Shared textarea classes. Lifted out of each modal because three of the
 * five modals rendered the exact same `<textarea>` wrapper inline.
 */
export const TEXTAREA_CLASS =
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
