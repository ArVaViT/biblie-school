import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import { toast } from "@/hooks/use-toast"
import type { Quiz } from "@/types"
import { Plus, Trash2, Save, ClipboardList, Loader2, ArrowUp, ArrowDown } from "lucide-react"

interface QuizEditorProps {
  chapterId: string
  chapterType?: "quiz" | "exam"
  onQuizSaved?: (quizId: string) => void
}

interface DraftOption {
  id: string
  option_text: string
  is_correct: boolean
  order_index: number
}

interface DraftQuestion {
  id: string
  question_text: string
  question_type: "multiple_choice" | "true_false" | "short_answer"
  order_index: number
  points: number
  options: DraftOption[]
}

let _uid = 0
function uid() {
  return `draft-${++_uid}-${Date.now()}`
}

function makeTrueFalseOptions(): DraftOption[] {
  return [
    { id: uid(), option_text: "True", is_correct: true, order_index: 0 },
    { id: uid(), option_text: "False", is_correct: false, order_index: 1 },
  ]
}

function makeDefaultOption(order: number): DraftOption {
  return { id: uid(), option_text: "", is_correct: false, order_index: order }
}

function makeDefaultQuestion(order: number): DraftQuestion {
  return {
    id: uid(),
    question_text: "",
    question_type: "multiple_choice",
    order_index: order,
    points: 1,
    options: [makeDefaultOption(0), makeDefaultOption(1)],
  }
}

export default function QuizEditor({ chapterId, chapterType = "quiz", onQuizSaved }: QuizEditorProps) {
  const [existingQuiz, setExistingQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [passingScore, setPassingScore] = useState(70)
  const [maxAttempts, setMaxAttempts] = useState<number>(1)
  const [questions, setQuestions] = useState<DraftQuestion[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const q = await coursesService.getChapterQuiz(chapterId)
        if (cancelled) return
        if (q) {
          setExistingQuiz(q)
          setTitle(q.title)
          setDescription(q.description ?? "")
          setPassingScore(q.passing_score)
          setMaxAttempts(q.max_attempts ?? 1)
          setQuestions(
            q.questions
              .sort((a, b) => a.order_index - b.order_index)
              .map((qu) => ({
                ...qu,
                options: qu.options
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((o) => ({ ...o, is_correct: !!o.is_correct })),
              })),
          )
        } else {
          setMaxAttempts(chapterType === "exam" ? 1 : 3)
        }
      } catch {
        if (!cancelled) setQuestions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [chapterId, chapterType])

  const addQuestion = () => {
    setQuestions((prev) => [...prev, makeDefaultQuestion(prev.length)])
  }

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i })))
  }

  const moveQuestion = (idx: number, direction: "up" | "down") => {
    setQuestions((prev) => {
      const next = [...prev]
      const targetIdx = direction === "up" ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= next.length) return prev
      ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
      return next.map((q, i) => ({ ...q, order_index: i }))
    })
  }

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q
        const updated = { ...q, ...patch }
        if (patch.question_type && patch.question_type !== q.question_type) {
          if (patch.question_type === "true_false") {
            updated.options = makeTrueFalseOptions()
          } else if (patch.question_type === "short_answer") {
            updated.options = []
          } else {
            updated.options = [makeDefaultOption(0), makeDefaultOption(1)]
          }
        }
        return updated
      }),
    )
  }

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: [...q.options, makeDefaultOption(q.options.length)] } : q,
      ),
    )
  }

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.filter((_, j) => j !== oIdx).map((o, j) => ({ ...o, order_index: j })) }
          : q,
      ),
    )
  }

  const updateOption = (qIdx: number, oIdx: number, patch: Partial<DraftOption>) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((o, j) => {
                if (j !== oIdx) {
                  if (patch.is_correct) return { ...o, is_correct: false }
                  return o
                }
                return { ...o, ...patch }
              }),
            }
          : q,
      ),
    )
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Quiz title is required", variant: "destructive" })
      return
    }
    if (questions.length === 0) {
      toast({ title: "Add at least one question", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const oldQuizId = existingQuiz?.id
      const quiz = await coursesService.createQuiz({
        chapter_id: chapterId,
        title: title.trim(),
        description: description.trim() || null,
        quiz_type: chapterType,
        max_attempts: chapterType === "exam" ? maxAttempts : null,
        passing_score: passingScore,
        questions: questions.map((q) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          order_index: q.order_index,
          points: q.points,
          options: q.options.map((o) => ({
            option_text: o.option_text,
            is_correct: o.is_correct,
            order_index: o.order_index,
          })),
        })),
      })
      setExistingQuiz(quiz)
      onQuizSaved?.(quiz.id)
      setMaxAttempts(quiz.max_attempts ?? (chapterType === "exam" ? 1 : 3))
      if (oldQuizId) {
        await coursesService.deleteQuiz(oldQuizId).catch(() => {
          // Old quiz cleanup is best-effort; the new quiz was already saved
        })
      }
      toast({ title: "Quiz saved", variant: "success" })
    } catch {
      toast({ title: "Failed to save quiz", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existingQuiz || !confirm("Delete this quiz? Students will lose access.")) return
    setDeleting(true)
    try {
      await coursesService.deleteQuiz(existingQuiz.id)
      setExistingQuiz(null)
      setTitle("")
      setDescription("")
      setPassingScore(70)
      setMaxAttempts(chapterType === "exam" ? 1 : 3)
      setQuestions([])
      toast({ title: "Quiz deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete quiz", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium">
          {existingQuiz ? `Edit ${chapterType === "exam" ? "Exam" : "Quiz"}` : `Create ${chapterType === "exam" ? "Exam" : "Quiz"}`}
        </span>
      </div>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Quiz Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter Review Quiz"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the quiz..."
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Passing Score (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
            className="h-8 text-sm w-28"
          />
        </div>
        {chapterType === "exam" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Maximum Attempts</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="h-8 text-sm w-28"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Questions ({questions.length})</span>
          <Button variant="outline" size="sm" onClick={addQuestion} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Add Question
          </Button>
        </div>

        {questions.map((q, qIdx) => (
          <Card key={q.id} className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIdx, "up")}
                    disabled={qIdx === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIdx, "down")}
                    disabled={qIdx === questions.length - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Q{qIdx + 1}</span>
                    <Input
                      value={q.question_text}
                      onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })}
                      placeholder="Question text..."
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 w-7 p-0 shrink-0"
                      onClick={() => removeQuestion(qIdx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={q.question_type}
                      onChange={(e) =>
                        updateQuestion(qIdx, {
                          question_type: e.target.value as DraftQuestion["question_type"],
                        })
                      }
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True / False</option>
                      <option value="short_answer">Short Answer</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Points:</Label>
                      <Input
                        type="number"
                        min={1}
                        value={q.points}
                        onChange={(e) => updateQuestion(qIdx, { points: Number(e.target.value) || 1 })}
                        className="h-7 text-xs w-16"
                      />
                    </div>
                  </div>

                  {q.question_type === "multiple_choice" && (
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={opt.is_correct}
                            onChange={() => updateOption(qIdx, oIdx, { is_correct: true })}
                            className="accent-primary shrink-0"
                            title="Mark as correct"
                          />
                          <Input
                            value={opt.option_text}
                            onChange={(e) => updateOption(qIdx, oIdx, { option_text: e.target.value })}
                            placeholder={`Option ${oIdx + 1}`}
                            className="h-7 text-xs flex-1"
                          />
                          {q.options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => removeOption(qIdx, oIdx)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addOption(qIdx)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Option
                      </Button>
                    </div>
                  )}

                  {q.question_type === "true_false" && (
                    <div className="flex gap-3">
                      {q.options.map((opt, oIdx) => (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer ${
                            opt.is_correct
                              ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                              : "border-border"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={opt.is_correct}
                            onChange={() => updateOption(qIdx, oIdx, { is_correct: true })}
                            className="accent-primary"
                          />
                          {opt.option_text}
                        </label>
                      ))}
                    </div>
                  )}

                  {q.question_type === "short_answer" && (
                    <p className="text-xs text-muted-foreground italic">
                      Students will type a free-text answer. Graded manually.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {questions.length === 0 && (
          <div className="text-center py-6 border border-dashed rounded-md text-sm text-muted-foreground">
            No questions yet. Click "Add Question" to start.
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          {saving ? "Saving..." : `Save ${chapterType === "exam" ? "Exam" : "Quiz"}`}
        </Button>
      {existingQuiz && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {`Delete ${chapterType === "exam" ? "Exam" : "Quiz"}`}
          </Button>
        )}
      </div>
    </div>
  )
}
