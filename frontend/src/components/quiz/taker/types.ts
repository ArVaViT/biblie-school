export interface QuizAnswer {
  selected_option_id?: string
  text_answer?: string
}

export type AnswerMap = Record<string, QuizAnswer>
