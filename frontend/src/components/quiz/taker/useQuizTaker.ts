import { useEffect, useState } from "react"
import { coursesService } from "@/services/courses"
import type { Quiz, QuizAttempt } from "@/types"

interface Params {
  chapterId: string
  quizId?: string
}

interface UseQuizTakerResult {
  loading: boolean
  fetchError: boolean
  quiz: Quiz | null
  attempts: QuizAttempt[]
  setAttempts: React.Dispatch<React.SetStateAction<QuizAttempt[]>>
}

export function useQuizTaker({ chapterId, quizId }: Params): UseQuizTakerResult {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(false)
    setAttempts([])
    setQuiz(null)

    const load = async () => {
      try {
        const [q, preloadedAttempts] = quizId
          ? await Promise.all([
              coursesService.getChapterQuiz(chapterId),
              coursesService.getMyQuizAttempts(quizId).catch(() => [] as QuizAttempt[]),
            ])
          : [await coursesService.getChapterQuiz(chapterId), null]
        if (cancelled) return
        const resolved = quizId && q && q.id !== quizId ? null : q
        setQuiz(resolved)
        if (resolved) {
          const att =
            preloadedAttempts ??
            (await coursesService
              .getMyQuizAttempts(resolved.id)
              .catch(() => [] as QuizAttempt[]))
          if (!cancelled) setAttempts(att)
        }
      } catch {
        if (!cancelled) setFetchError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [chapterId, quizId])

  return { loading, fetchError, quiz, attempts, setAttempts }
}
