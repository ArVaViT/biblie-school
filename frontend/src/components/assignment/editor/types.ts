import type { Assignment } from "@/types"

export interface AssignmentFormState {
  title: string
  description: string
  maxScore: number
  dueDate: string
}

export const EMPTY_ASSIGNMENT_FORM: AssignmentFormState = {
  title: "",
  description: "",
  maxScore: 100,
  dueDate: "",
}

export function assignmentToFormState(a: Assignment): AssignmentFormState {
  return {
    title: a.title,
    description: a.description ?? "",
    maxScore: a.max_score,
    dueDate: a.due_date?.slice(0, 10) ?? "",
  }
}

/**
 * Converts the UI form into the `create`/`update` payload shape. Empty
 * strings become null so the backend clears the column.
 */
export function formStateToPayload(form: AssignmentFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    max_score: form.maxScore,
    due_date: form.dueDate || null,
  }
}
