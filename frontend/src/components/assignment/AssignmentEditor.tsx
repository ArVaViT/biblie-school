import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import { toast } from "@/hooks/use-toast"
import type { Assignment, AssignmentSubmission } from "@/types"
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  User,
  MessageSquare,
  Star,
} from "lucide-react"

interface AssignmentEditorProps {
  chapterId: string
  onAssignmentCreated?: (assignmentId: string) => void
}

export default function AssignmentEditor({ chapterId, onAssignmentCreated }: AssignmentEditorProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newMaxScore, setNewMaxScore] = useState(100)
  const [newDueDate, setNewDueDate] = useState("")
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

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

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast({ title: "Assignment title is required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const a = await coursesService.createAssignment({
        chapter_id: chapterId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        max_score: newMaxScore,
        due_date: newDueDate || null,
      })
      setAssignments((prev) => [...prev, a])
      onAssignmentCreated?.(a.id)
      setNewTitle("")
      setNewDesc("")
      setNewMaxScore(100)
      setNewDueDate("")
      setShowCreate(false)
      toast({ title: "Assignment created", variant: "success" })
    } catch {
      toast({ title: "Failed to create assignment", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this assignment and all submissions?")) return
    try {
      await coursesService.deleteAssignment(id)
      setAssignments((prev) => prev.filter((a) => a.id !== id))
      toast({ title: "Assignment deleted", variant: "success" })
    } catch {
      toast({ title: "Failed to delete assignment", variant: "destructive" })
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium">Assignments ({assignments.length})</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3 w-3 mr-1" />
          New Assignment
        </Button>
      </div>

      {showCreate && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Chapter Reflection Essay"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Assignment instructions..."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>
            <div className="flex gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Max Score</Label>
                <Input
                  type="number"
                  min={1}
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(Number(e.target.value) || 100)}
                  className="h-8 text-sm w-24"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date (optional)</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                {creating ? "Creating..." : "Create Assignment"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignments.map((a) => (
        <AssignmentItem key={a.id} assignment={a} onDelete={handleDelete} />
      ))}

      {assignments.length === 0 && !showCreate && (
        <div className="text-center py-6 border border-dashed rounded-md text-sm text-muted-foreground">
          No assignments for this chapter.
        </div>
      )}
    </div>
  )
}

function AssignmentItem({
  assignment,
  onDelete,
}: {
  assignment: Assignment
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)

  const toggleExpand = async () => {
    if (!expanded) {
      setLoadingSubs(true)
      try {
        const subs = await coursesService.getSubmissions(assignment.id)
        setSubmissions(subs)
      } catch {
        // error
      } finally {
        setLoadingSubs(false)
      }
    }
    setExpanded(!expanded)
  }

  return (
    <Card>
      <div className="flex items-center gap-2 p-3 cursor-pointer select-none" onClick={toggleExpand}>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{assignment.title}</span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Max: {assignment.max_score} pts</span>
            {assignment.due_date && (
              <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 w-7 p-0 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(assignment.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {assignment.description && (
            <p className="text-xs text-muted-foreground py-2">{assignment.description}</p>
          )}

          {loadingSubs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No submissions yet.</p>
          ) : (
            <div className="space-y-3 mt-3">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Submissions ({submissions.length})
              </h4>
              {submissions.map((sub) => (
                <SubmissionGrader
                  key={sub.id}
                  submission={sub}
                  maxScore={assignment.max_score}
                  onUpdate={(updated) => {
                    setSubmissions((prev) =>
                      prev.map((s) => (s.id === updated.id ? updated : s)),
                    )
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function SubmissionGrader({
  submission,
  maxScore,
  onUpdate,
}: {
  submission: AssignmentSubmission
  maxScore: number
  onUpdate: (updated: AssignmentSubmission) => void
}) {
  const [grade, setGrade] = useState(submission.grade ?? 0)
  const [feedback, setFeedback] = useState(submission.feedback ?? "")
  const [status, setStatus] = useState(submission.status)
  const [grading, setGrading] = useState(false)

  const handleGrade = async () => {
    setGrading(true)
    try {
      const updated = await coursesService.gradeSubmission(submission.id, {
        grade,
        feedback: feedback.trim() || undefined,
        status,
      })
      onUpdate(updated)
      toast({ title: "Submission graded", variant: "success" })
    } catch {
      toast({ title: "Failed to grade", variant: "destructive" })
    } finally {
      setGrading(false)
    }
  }

  const statusColors: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    graded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    returned: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  }

  return (
    <Card className="bg-muted/20">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {submission.student_id.slice(0, 8)}...
            </span>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[submission.status]}`}>
            {submission.status}
          </span>
        </div>

        {submission.content && (
          <div className="rounded bg-background p-2 text-sm whitespace-pre-wrap border">
            {submission.content}
          </div>
        )}

        {submission.file_url && (
          <a
            href={submission.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <FileText className="h-3 w-3" />
            View attached file
          </a>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              max={maxScore}
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="h-7 text-xs w-20"
            />
            <span className="text-xs text-muted-foreground">/ {maxScore}</span>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AssignmentSubmission["status"])}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="graded">Grade</option>
            <option value="returned">Return for revision</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Feedback
          </Label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional feedback for the student..."
            className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>

        <Button size="sm" className="h-7 text-xs" onClick={handleGrade} disabled={grading}>
          {grading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          {grading ? "Saving..." : "Save Grade"}
        </Button>
      </CardContent>
    </Card>
  )
}
