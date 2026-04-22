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
            (await coursesService.getMyQuizAttempts(resolved.id).catch(() => [] as QuizAttempt[]))
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
    if (q.question_type === "short_answer" || q.question_type === "essay") {
      const text = a.text_answer?.trim() ?? ""
      if (!text) return false
      // For ``essay`` the teacher can enforce a minimum length; we block
      // submit until that's reached so students don't accidentally submit
      // half-written work and burn an attempt on an exam.
      if (q.question_type === "essay" && q.min_words && q.min_words > 0) {
        const words = text.split(/\s+/).filter(Boolean).length
        if (words < q.min_words) return false
      }
      return true
    }
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
  // auto-graded score. Open-ended answers (``short_answer`` + ``essay``) are
  // scored by the teacher later.
  const autoMaxScore = sortedQuestions
    .filter((q) => q.question_type === "multiple_choice" || q.question_type === "true_false")
    .reduce((sum, q) => sum + q.points, 0)
  const manualMaxScore = sortedQuestions
    .filter((q) => q.question_type === "short_answer" || q.question_type === "essay")
    .reduce((sum, q) => sum + q.points, 0)
  const totalMaxScore = autoMaxScore + manualMaxScore

  return (
    <div className="border rounded-lg bg-card mt-6">
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h3 className="min-w-0 flex-1 text-base font-semibold text-wrap-safe">{quiz.title}</h3>
        </div>
        {quiz.description && (
          <p className="ml-7 text-sm text-muted-foreground text-wrap-safe whitespace-pre-line">
            {quiz.description}
          </p>
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
            <div className="rounded-md border border-border border-l-[3px] border-l-warning bg-warning/10 px-3 py-2 text-xs text-foreground">
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
                  ? "border border-success/30 bg-success/10"
                  : "border border-destructive/30 bg-destructive/10"
              return (
                <div
                  key={att.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${style}`}
                >
                  <div className="flex items-center gap-2">
                    {inProgress ? (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    ) : att.passed ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
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
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 text-wrap-safe">
          <p className="text-sm font-medium whitespace-pre-line">{question.question_text}</p>
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

      {question.question_type === "essay" && (
        <EssayAnswer
          value={answer?.text_answer ?? ""}
          minWords={question.min_words}
          onChange={(text) => onAnswer({ text_answer: text })}
        />
      )}
    </div>
  )
}

function EssayAnswer({
  value,
  minWords,
  onChange,
}: {
  value: string
  minWords: number | null
  onChange: (text: string) => void
}) {
  const words = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0
  const minReached = !minWords || words >= minWords
  return (
    <div className="ml-8 space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          minWords
            ? `Write at least ${minWords} words. Your response will be reviewed by the teacher.`
            : "Write your essay response…"
        }
        className="w-full min-h-[220px] p-3 text-sm bg-background border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Essay · graded by the teacher</span>
        <span className={minReached ? "text-muted-foreground" : "text-warning font-medium"}>
          {words} word{words === 1 ? "" : "s"}
          {minWords ? ` / ${minWords} required` : ""}
        </span>
      </div>
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
      <Card className={result.passed ? "border-l-[3px] border-l-success" : "border-l-[3px] border-l-destructive"}>
        <CardContent className="py-6 text-center">
          {result.passed ? (
            <Trophy className="mx-auto mb-3 h-10 w-10 text-success" />
          ) : (
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
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
          {questions.some((q) => q.question_type === "short_answer" || q.question_type === "essay") && (
            <p className="mt-2 text-xs text-warning">
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
          const isManual = q.question_type === "short_answer" || q.question_type === "essay"
          // For manual questions we only flash ✓/✗ once the teacher has
          // actually touched the row (non-zero points or an attached
          // comment). Otherwise the card stays neutral — "pending review".
          const hasGrade =
            isManual &&
            !!answerResult &&
            (answerResult.points_earned > 0 || !!answerResult.grader_comment)
          const isCorrect = isManual
            ? hasGrade
              ? answerResult?.is_correct ?? null
              : null
            : answerResult?.is_correct ?? null

          return (
            <div
              key={q.id}
              className={`rounded-md border p-3 ${
                isCorrect === null
                  ? "border-border"
                  : isCorrect
                    ? "border-success/30 bg-success/5"
                    : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {idx + 1}
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium text-wrap-safe whitespace-pre-line">
                  {q.question_text}
                </p>
                {isCorrect !== null && (
                  <span className="shrink-0">
                    {isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </span>
                )}
              </div>
              {!isManual && (
                <div className="ml-7 space-y-1">
                  {[...(q.options ?? [])].sort((a, b) => a.order_index - b.order_index).map((opt) => {
                    const isSelected = userAnswer?.selected_option_id === opt.id
                    const isRight = answerResult?.correct_option_id === opt.id
                    return (
                      <div
                        key={opt.id}
                        className={`rounded px-2 py-1 text-xs ${
                          isRight
                            ? "bg-success/15 font-medium text-success"
                            : isSelected
                              ? "bg-destructive/15 text-destructive"
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
              {isManual && (
                <div className="ml-7 space-y-1.5">
                  {hasGrade ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-1 font-medium text-success">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Graded · {answerResult?.points_earned ?? 0}/{q.points} pt
                        {q.points !== 1 ? "s" : ""}
                      </span>
                      {answerResult?.grader_comment && (
                        <span className="text-muted-foreground">
                          “{answerResult.grader_comment}”
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex w-fit items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      Sent for teacher review
                    </div>
                  )}
                  {userAnswer?.text_answer && (
                    <p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
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
