import { CheckCircle, Clock, XCircle } from "lucide-react"
import type { QuizAttempt } from "@/types"

interface Props {
  attempts: QuizAttempt[]
  autoMaxScore: number
}

export function PreviousAttempts({ attempts, autoMaxScore }: Props) {
  if (attempts.length === 0) return null
  return (
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
  )
}
