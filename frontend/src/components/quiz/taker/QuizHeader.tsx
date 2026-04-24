import { ClipboardList } from "lucide-react"
import type { Quiz } from "@/types"

interface Props {
  quiz: Quiz
  questionCount: number
  autoMaxScore: number
  manualMaxScore: number
  maxAttempts: number | null
  attemptsUsed: number
}

export function QuizHeader({
  quiz,
  questionCount,
  autoMaxScore,
  manualMaxScore,
  maxAttempts,
  attemptsUsed,
}: Props) {
  const totalMaxScore = autoMaxScore + manualMaxScore
  return (
    <div className="p-5 border-b">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
        <h3 className="min-w-0 flex-1 text-base font-semibold text-wrap-safe">
          {quiz.title}
        </h3>
      </div>
      {quiz.description && (
        <p className="ml-7 text-sm text-muted-foreground text-wrap-safe whitespace-pre-line">
          {quiz.description}
        </p>
      )}
      <div className="flex items-center gap-4 ml-7 mt-2 text-xs text-muted-foreground">
        <span>
          {questionCount} question{questionCount !== 1 ? "s" : ""}
        </span>
        <span>
          {totalMaxScore} point{totalMaxScore !== 1 ? "s" : ""}
          {manualMaxScore > 0 && autoMaxScore > 0 && (
            <>
              {" "}
              ({autoMaxScore} auto + {manualMaxScore} review)
            </>
          )}
        </span>
        <span>Passing: {quiz.passing_score}%</span>
        {maxAttempts !== null && (
          <span>
            Attempts: {attemptsUsed}/{maxAttempts}
          </span>
        )}
      </div>
    </div>
  )
}
