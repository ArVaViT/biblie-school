import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { getErrorDetail } from "@/lib/errorDetail"
import type { Quiz, QuizAttempt, QuizQuestion } from "@/types"
import {
  CheckCircle,
  XCircle,
  ClipboardList,
  Trophy,
  Clock,
  AlertCircle,
  Loader2,
  BookOpen,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import PageSpinner from "@/components/ui/PageSpinner"

interface QuizTakerProps {
  chapterId: string
  /**
   * When rendered from a ``ChapterBlock`` that points at a specific quiz, pass
   * ``block.quiz_id`` so we only surface that quiz. Otherwise the chapter-level
   * fallback is used (``GET /quizzes/chapter/{id}`` returns the first quiz).
   */
  quizId?: string
  // Called after a successful submit regardless of pass/fail so the parent
  // can re-fetch chapter progress. Without this, a passing attempt would
  // complete the chapter on the server but the next chapter in the UI
  // stayed locked until a full page refresh (completedIds was stale).
  onSubmitted?: () => void
}

export default function QuizTaker({ chapterId, quizId, onSubmitted }: QuizTakerProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; text_answer?: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizAttempt | null>(null)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(false)
    setAnswers({})
    setResult(null)
    setShowResults(false)
    setAttempts([])
    setQuiz(null)

    const load = async () => {
      try {
        const q = await coursesService.getChapterQuiz(chapterId)
        if (cancelled) return
        // If the caller pinned a specific quiz (e.g. from a ``ChapterBlock``),
        // only accept that one. Currently a chapter carries a single quiz so
        // this is mostly defensive, but it future-proofs the UI against a
        // chapter having multiple quizzes where ``getChapterQuiz`` would
        // return an arbitrary first hit.
        const resolved = quizId && q && q.id !== quizId ? null : q
        setQuiz(resolved)
        if (resolved) {
          const att = await coursesService.getMyQuizAttempts(resolved.id).catch(() => [] as QuizAttempt[])
          if (!cancelled) setAttempts(att)
        }
      } catch {
        if (!cancelled) setFetchError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [chapterId, quizId])

  if (loading) {
    return <PageSpinner variant="section" />
  }
  if (fetchError) return (
    <p className="text-sm text-destructive py-4 text-center">Failed to load quiz. Please try refreshing the page.</p>
  )
  if (!quiz || (quiz.questions ?? []).length === 0) return null

  const sortedQuestions = [...(quiz.questions ?? [])].sort((a, b) => a.order_index - b.order_index)
  const maxAttempts = quiz.max_attempts ?? null
  const attemptsUsed = attempts.filter((a) => !!a.completed_at).length
  const attemptsReached = maxAttempts !== null && attemptsUsed >= maxAttempts
  const assessmentLabel = quiz.quiz_type === "exam" ? "Exam" : "Quiz"

  const setAnswer = (questionId: string, value: { selected_option_id?: string; text_answer?: string }) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const allAnswered = sortedQuestions.every((q) => {
    const a = answers[q.id]
    if (!a) return false
    if (q.question_type === "short_answer") return !!a.text_answer?.trim()
    return !!a.selected_option_id
  })

  const handleSubmit = async () => {
    if (!allAnswered) return
    setSubmitting(true)
    try {
      const payload = sortedQuestions.map((q) => ({
        question_id: q.id,
        selected_option_id: answers[q.id]?.selected_option_id,
        text_answer: answers[q.id]?.text_answer,
      }))
      const attempt = await coursesService.submitQuiz(quiz.id, payload)
      setResult(attempt)
      setShowResults(true)
      setAttempts((prev) => [attempt, ...prev])
      onSubmitted?.()
    } catch (error: unknown) {
      const detail = getErrorDetail(error)
      toast({ title: detail || `Failed to submit ${assessmentLabel.toLowerCase()}`, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // Mirrors the backend: only MCQ / true-false questions contribute to the
  // auto-graded score. Open-ended answers are scored by the teacher later.
  const autoMaxScore = sortedQuestions
    .filter((q) => q.question_type === "multiple_choice" || q.question_type === "true_false")
    .reduce((sum, q) => sum + q.points, 0)
  const manualMaxScore = sortedQuestions
    .filter((q) => q.question_type === "short_answer")
    .reduce((sum, q) => sum + q.points, 0)
  const totalMaxScore = autoMaxScore + manualMaxScore

  return (
    <div className="border rounded-lg bg-card mt-6">
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-base">{quiz.title}</h3>
        </div>
        {quiz.description && (
          <p className="text-sm text-muted-foreground ml-7">{quiz.description}</p>
        )}
        <div className="flex items-center gap-4 ml-7 mt-2 text-xs text-muted-foreground">
          <span>{sortedQuestions.length} question{sortedQuestions.length !== 1 ? "s" : ""}</span>
          <span>
            {totalMaxScore} point{totalMaxScore !== 1 ? "s" : ""}
            {manualMaxScore > 0 && autoMaxScore > 0 && (
              <> ({autoMaxScore} auto + {manualMaxScore} review)</>
            )}
          </span>
          <span>Passing: {quiz.passing_score}%</span>
          {maxAttempts !== null && <span>Attempts: {attemptsUsed}/{maxAttempts}</span>}
        </div>
      </div>

      {showResults && result ? (
        <>
          <ResultsView
            result={result}
            quiz={quiz}
            questions={sortedQuestions}
            answers={answers}
          />
          {!attemptsReached && (
            <div className="px-5 pb-5">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowResults(false)
                  setAnswers({})
                  setResult(null)
                }}
              >
                Try Again
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="p-5 space-y-6">
          {attemptsReached && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              Maximum attempts reached for this {assessmentLabel.toLowerCase()}.
            </div>
          )}
          {sortedQuestions.map((question, idx) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={idx}
              answer={answers[question.id]}
              onAnswer={(val) => setAnswer(question.id, val)}
            />
          ))}

          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting || attemptsReached}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              `Submit ${assessmentLabel}`
            )}
          </Button>
          {!allAnswered && !attemptsReached && (
            <p className="text-xs text-muted-foreground text-center">Answer all questions to submit</p>
          )}
        </div>
      )}

      {attempts.length > 0 && (
        <div className="border-t p-5">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Previous Attempts
          </h4>
          <div className="space-y-2">
            {attempts.map((att) => {
              // An in-progress attempt has ``completed_at === null`` and
              // ``passed === null`` — don't paint it as a failed attempt.
              const inProgress = !att.completed_at
              const style = inProgress
                ? "bg-muted/30 border border-border"
                : att.passed
                  ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
              return (
                <div
                  key={att.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${style}`}
                >
                  <div className="flex items-center gap-2">
                    {inProgress ? (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    ) : att.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span>
                      {att.score ?? 0}/{att.max_score ?? autoMaxScore} points
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {att.completed_at
                      ? new Date(att.completed_at).toLocaleDateString()
                      : "In progress"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
}: {
  question: QuizQuestion
  index: number
  answer?: { selected_option_id?: string; text_answer?: string }
  onAnswer: (val: { selected_option_id?: string; text_answer?: string }) => void
}) {
  const sortedOptions = [...(question.options ?? [])].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div>
          <p className="text-sm font-medium">{question.question_text}</p>
          <span className="text-xs text-muted-foreground">{question.points} pt{question.points !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {question.question_type === "multiple_choice" && (
        <div className="ml-8 space-y-2">
          {sortedOptions.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                answer?.selected_option_id === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={answer?.selected_option_id === opt.id}
                onChange={() => onAnswer({ selected_option_id: opt.id })}
                className="accent-primary"
              />
              <span className="text-sm">{opt.option_text}</span>
            </label>
          ))}
        </div>
      )}

      {question.question_type === "true_false" && (
        <div className="ml-8 flex gap-3">
          {sortedOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onAnswer({ selected_option_id: opt.id })}
              className={`flex-1 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                answer?.selected_option_id === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {opt.option_text}
            </button>
          ))}
        </div>
      )}

      {question.question_type === "short_answer" && (
        <div className="ml-8">
          <textarea
            value={answer?.text_answer ?? ""}
            onChange={(e) => onAnswer({ text_answer: e.target.value })}
            placeholder="Type your answer..."
            className="w-full min-h-[80px] p-3 text-sm bg-background border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
          />
        </div>
      )}
    </div>
  )
}

function ResultsView({
  result,
  quiz,
  questions,
  answers,
}: {
  result: QuizAttempt
  quiz: Quiz
  questions: QuizQuestion[]
  answers: Record<string, { selected_option_id?: string; text_answer?: string }>
}) {
  const scorePercent = result.max_score ? Math.round(((result.score ?? 0) / result.max_score) * 100) : 0

  const answerMap = new Map(
    (result.answers ?? []).map((a) => [a.question_id, a])
  )

  return (
    <div className="p-5 space-y-6">
      <Card className={result.passed ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700"}>
        <CardContent className="py-6 text-center">
          {result.passed ? (
            <Trophy className="h-10 w-10 text-green-500 mx-auto mb-3" />
          ) : (
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          )}
          <h3 className="text-lg font-bold mb-1">
            {result.passed ? "You Passed!" : "Not Quite"}
          </h3>
          <p className="text-2xl font-bold mb-1">
            {result.score ?? 0}/{result.max_score ?? 0}
          </p>
          <p className="text-sm text-muted-foreground">
            {scorePercent}% — Passing score: {quiz.passing_score}%
          </p>
          {questions.some((q) => q.question_type === "short_answer") && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Open-ended answers are pending teacher review
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Review Answers</h4>
        {questions.map((q, idx) => {
          const userAnswer = answers[q.id]
          const answerResult = answerMap.get(q.id)
          const isCorrect =
            q.question_type === "short_answer"
              ? null
              : answerResult?.is_correct ?? null

          return (
            <div
              key={q.id}
              className={`rounded-md border p-3 ${
                isCorrect === null
                  ? "border-border"
                  : isCorrect
                    ? "border-green-300 bg-green-50/50 dark:bg-green-950/10"
                    : "border-red-300 bg-red-50/50 dark:bg-red-950/10"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-semibold shrink-0">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium">{q.question_text}</p>
                {isCorrect !== null && (
                  <span className="ml-auto shrink-0">
                    {isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </span>
                )}
              </div>
              {q.question_type !== "short_answer" && (
                <div className="ml-7 space-y-1">
                  {[...(q.options ?? [])].sort((a, b) => a.order_index - b.order_index).map((opt) => {
                    const isSelected = userAnswer?.selected_option_id === opt.id
                    const isRight = answerResult?.correct_option_id === opt.id
                    return (
                      <div
                        key={opt.id}
                        className={`text-xs px-2 py-1 rounded ${
                          isRight
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium"
                            : isSelected
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        {isSelected && !isRight ? "✗ " : ""}
                        {isRight ? "✓ " : ""}
                        {opt.option_text}
                      </div>
                    )
                  })}
                </div>
              )}
              {q.question_type === "short_answer" && (
                <div className="ml-7 space-y-1.5">
                  <div className="flex items-center gap-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium w-fit">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    Sent for teacher review
                  </div>
                  {userAnswer?.text_answer && (
                    <p className="text-xs text-muted-foreground italic">
                      Your answer: {userAnswer.text_answer}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
