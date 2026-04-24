import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Loader2, MessageSquare, Save, Star, User } from "lucide-react"
import { coursesService } from "@/services/courses"
import { toast } from "@/lib/toast"
import type { AssignmentSubmission } from "@/types"

interface Props {
  submission: AssignmentSubmission
  maxScore: number
  onUpdate: (updated: AssignmentSubmission) => void
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-info/15 text-info",
  graded: "bg-success/15 text-success",
  returned: "bg-warning/15 text-warning",
}

export function SubmissionGrader({ submission, maxScore, onUpdate }: Props) {
  const [grade, setGrade] = useState(submission.grade ?? 0)
  const [feedback, setFeedback] = useState(submission.feedback ?? "")
  const [status, setStatus] = useState(submission.status)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
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
      setSaving(false)
    }
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
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[submission.status]}`}
          >
            {submission.status}
          </span>
        </div>

        {submission.content && (
          <div className="rounded border bg-background p-2 text-sm whitespace-pre-wrap text-wrap-safe">
            {submission.content}
          </div>
        )}

        {submission.file_url && (
          <a
            href={submission.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-info hover:underline"
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

        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          {saving ? "Saving..." : "Save Grade"}
        </Button>
      </CardContent>
    </Card>
  )
}
