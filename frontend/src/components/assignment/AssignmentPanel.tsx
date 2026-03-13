import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import { toast } from "@/hooks/use-toast"
import type { Assignment, AssignmentSubmission } from "@/types"
import {
  FileText,
  Calendar,
  Star,
  Send,
  CheckCircle,
  Clock,
  RotateCcw,
  Loader2,
  MessageSquare,
  Link as LinkIcon,
} from "lucide-react"

interface AssignmentPanelProps {
  chapterId: string
  onSubmitted?: () => void
}

export default function AssignmentPanel({ chapterId, onSubmitted }: AssignmentPanelProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await coursesService.getChapterAssignments(chapterId)
        if (!cancelled) setAssignments(data)
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [chapterId])

  if (loading) return null
  if (assignments.length === 0) return null

  return (
    <div className="space-y-4 mt-6">
      {assignments.map((assignment) => (
        <SingleAssignment key={assignment.id} assignment={assignment} onSubmitted={onSubmitted} />
      ))}
    </div>
  )
}

function SingleAssignment({ assignment, onSubmitted }: { assignment: Assignment; onSubmitted?: () => void }) {
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null)
  const [loadingSub, setLoadingSub] = useState(true)
  const [content, setContent] = useState("")
  const [fileUrl, setFileUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const subs = await coursesService.getSubmissions(assignment.id)
        if (!cancelled && subs.length > 0) {
          setSubmission(subs[0])
        }
      } catch {
        // May fail if no submission
      } finally {
        if (!cancelled) setLoadingSub(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [assignment.id])

  const handleSubmit = async () => {
    if (!content.trim() && !fileUrl.trim()) return
    setSubmitting(true)
    try {
      const sub = await coursesService.submitAssignment(assignment.id, {
        content: content.trim() || undefined,
        file_url: fileUrl.trim() || undefined,
      })
      setSubmission(sub)
      setContent("")
      setFileUrl("")
      onSubmitted?.()
    } catch {
      toast({ title: "Failed to submit assignment", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const canResubmit = submission?.status === "returned"
  const showForm = !submission || canResubmit

  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date()

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    submitted: {
      icon: <Clock className="h-4 w-4" />,
      label: "Submitted — Awaiting Review",
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    },
    graded: {
      icon: <CheckCircle className="h-4 w-4" />,
      label: "Graded",
      color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    },
    returned: {
      icon: <RotateCcw className="h-4 w-4" />,
      label: "Returned — Resubmission Requested",
      color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    },
  }

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-violet-500" />
          <h3 className="font-semibold text-base">{assignment.title}</h3>
        </div>
        {assignment.description && (
          <p className="text-sm text-muted-foreground ml-7">{assignment.description}</p>
        )}
        <div className="flex items-center gap-4 ml-7 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            Max: {assignment.max_score} pts
          </span>
          {assignment.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
              <Calendar className="h-3 w-3" />
              Due: {new Date(assignment.due_date).toLocaleDateString()}
              {isOverdue && " (overdue)"}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {loadingSub ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {submission && (
              <div className="mb-4 space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${statusConfig[submission.status]?.color ?? ""}`}>
                  {statusConfig[submission.status]?.icon}
                  <span className="font-medium">{statusConfig[submission.status]?.label}</span>
                </div>

                {submission.status === "graded" && submission.grade !== null && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/50 text-sm">
                    <span className="font-semibold text-lg">
                      {submission.grade}/{assignment.max_score}
                    </span>
                    <span className="text-muted-foreground">points</span>
                  </div>
                )}

                {submission.feedback && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      Instructor Feedback
                    </div>
                    <p className="text-sm">{submission.feedback}</p>
                  </div>
                )}

                {submission.content && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Your Submission</p>
                    <p className="text-sm whitespace-pre-wrap">{submission.content}</p>
                  </div>
                )}
              </div>
            )}

            {showForm && (
              <div className="space-y-3">
                {canResubmit && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Your instructor has returned this assignment. Please revise and resubmit.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Your Response</Label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your assignment response here..."
                    className="w-full min-h-[120px] p-3 text-sm bg-background border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <LinkIcon className="h-3 w-3" />
                    File Link (optional)
                  </Label>
                  <Input
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || (!content.trim() && !fileUrl.trim())}
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {submitting ? "Submitting..." : canResubmit ? "Resubmit" : "Submit"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
