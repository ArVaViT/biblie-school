import api from "./api"
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from "@/lib/cache"
import { isAxiosError } from "axios"
import type {
  Quiz,
  QuizAttempt,
  QuizAnswerResult,
  QuizQuestionType,
  PendingAnswer,
} from "@/types"

type QuizCreateData = {
  chapter_id: string
  title: string
  description?: string | null
  quiz_type?: "quiz" | "exam"
  max_attempts?: number | null
  passing_score: number
  questions: Array<{
    question_text: string
    question_type: QuizQuestionType
    order_index: number
    points: number
    min_words?: number | null
    options: Array<{
      option_text: string
      is_correct: boolean
      order_index: number
    }>
  }>
}

type QuizSubmissionAnswer = {
  question_id: string
  selected_option_id?: string
  text_answer?: string
}

export const quizzesService = {
  async getChapterQuiz(chapterId: string): Promise<Quiz | null> {
    const key = `quiz:chapter:${chapterId}`
    const cached = cacheGet<Quiz | null>(key)
    if (cached !== undefined) return cached
    try {
      const response = await api.get<Quiz | null>(`/quizzes/chapter/${chapterId}`)
      cacheSet(key, response.data, 2 * 60 * 1000)
      return response.data
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        cacheSet(key, null, 2 * 60 * 1000)
        return null
      }
      throw err
    }
  },

  async createQuiz(data: QuizCreateData): Promise<Quiz> {
    const response = await api.post<Quiz>("/quizzes", data)
    cacheInvalidate(`quiz:chapter:${data.chapter_id}`)
    return response.data
  },

  async deleteQuiz(quizId: string, chapterId?: string): Promise<void> {
    await api.delete(`/quizzes/${quizId}`)
    if (chapterId) {
      cacheInvalidate(`quiz:chapter:${chapterId}`)
    } else {
      cacheInvalidatePrefix("quiz:chapter:")
    }
  },

  async submitQuiz(quizId: string, answers: QuizSubmissionAnswer[]): Promise<QuizAttempt> {
    const response = await api.post<QuizAttempt>(`/quizzes/${quizId}/submit`, { answers })
    cacheInvalidatePrefix("progress:my:")
    return response.data
  },

  async getMyQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    const response = await api.get<QuizAttempt[]>(`/quizzes/${quizId}/my-attempts`)
    return response.data
  },

  async getPendingAnswers(quizId: string, includeGraded = false): Promise<PendingAnswer[]> {
    const response = await api.get<PendingAnswer[]>(
      `/quizzes/${quizId}/pending-answers`,
      { params: { include_graded: includeGraded } },
    )
    return response.data
  },

  async gradeQuizAnswer(
    answerId: string,
    pointsEarned: number,
    graderComment?: string | null,
  ): Promise<QuizAnswerResult> {
    const response = await api.patch<QuizAnswerResult>(`/quizzes/answers/${answerId}`, {
      points_earned: pointsEarned,
      grader_comment: graderComment ?? null,
    })
    return response.data
  },

  async grantExtraAttempts(
    quizId: string,
    userId: string,
    extraAttempts: number,
  ): Promise<void> {
    await api.post(`/quizzes/${quizId}/extra-attempts`, {
      user_id: userId,
      extra_attempts: extraAttempts,
    })
  },
}
