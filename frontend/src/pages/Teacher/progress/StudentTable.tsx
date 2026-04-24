import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Users } from "lucide-react"
import { StudentRow } from "./StudentRow"
import {
  assignmentAvg,
  overallGrade,
  quizAvg,
  type SortColumn,
  type SortDirection,
  type StudentData,
} from "./helpers"

interface Props {
  students: StudentData[]
  courseId: string
  hasSearch: boolean
  expandedId: string | null
  onExpandToggle: (id: string) => void
  sortBy: SortColumn
  sortDir: SortDirection
  onToggleSort: (col: SortColumn) => void
  onChapterUpdate: (
    studentId: string,
    chapterId: string,
    completed: boolean,
    completedBy: "teacher" | "self" | null,
  ) => void
}

export function StudentTable({
  students,
  courseId,
  hasSearch,
  expandedId,
  onExpandToggle,
  sortBy,
  sortDir,
  onToggleSort,
  onChapterUpdate,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Students
          <span className="text-sm font-normal text-muted-foreground">
            ({students.length})
          </span>
        </CardTitle>
        <CardDescription>Click a row to view detailed breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <EmptyState hasSearch={hasSearch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-2 w-8" />
                  <SortableHeader
                    label="Name"
                    col="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onToggle={onToggleSort}
                  />
                  <th className="pb-3 font-medium text-muted-foreground">Email</th>
                  <SortableHeader
                    label="Progress"
                    col="progress"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onToggle={onToggleSort}
                  />
                  <th className="pb-3 font-medium text-muted-foreground">Chapters</th>
                  <th className="pb-3 font-medium text-muted-foreground">Quiz Avg</th>
                  <th className="pb-3 font-medium text-muted-foreground">Assign. Avg</th>
                  <SortableHeader
                    label="Last Active"
                    col="last_activity"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onToggle={onToggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    isExpanded={expandedId === student.id}
                    onToggle={() => onExpandToggle(student.id)}
                    quizAvg={quizAvg(student)}
                    assignmentAvg={assignmentAvg(student)}
                    overallGrade={overallGrade(student)}
                    courseId={courseId}
                    onChapterUpdate={onChapterUpdate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">
        {hasSearch ? "No students match your search" : "No students enrolled yet"}
      </p>
    </div>
  )
}

interface SortableHeaderProps {
  label: string
  col: SortColumn
  sortBy: SortColumn
  sortDir: SortDirection
  onToggle: (col: SortColumn) => void
}

function SortableHeader({ label, col, sortBy, sortDir, onToggle }: SortableHeaderProps) {
  return (
    <th
      className="pb-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onToggle(col)}
    >
      {label}
      {sortBy === col && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  )
}
