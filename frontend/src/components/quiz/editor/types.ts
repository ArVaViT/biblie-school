import type { QuizQuestionType } from "@/types"

export interface DraftOption {
  id: string
  option_text: string
  is_correct: boolean
  order_index: number
}

export interface DraftQuestion {
  id: string
  question_text: string
  question_type: QuizQuestionType
  order_index: number
  points: number
  min_words: number | null
  options: DraftOption[]
}

let _uid = 0
export function uid(): string {
  return `draft-${++_uid}-${Date.now()}`
}

export function makeTrueFalseOptions(): DraftOption[] {
  return [
    { id: uid(), option_text: "True", is_correct: true, order_index: 0 },
    { id: uid(), option_text: "False", is_correct: false, order_index: 1 },
  ]
}

export function makeDefaultOption(order: number): DraftOption {
  return { id: uid(), option_text: "", is_correct: false, order_index: order }
}

export function makeDefaultQuestion(order: number): DraftQuestion {
  return {
    id: uid(),
    question_text: "",
    question_type: "multiple_choice",
    order_index: order,
    points: 1,
    min_words: null,
    options: [makeDefaultOption(0), makeDefaultOption(1)],
  }
}
