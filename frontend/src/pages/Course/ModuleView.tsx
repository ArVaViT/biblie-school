import { useEffect, useState, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { Module } from "@/types"
import {
  ArrowLeft,
  Book,
  CheckCircle,
  Circle,
  ChevronRight,
  Lock,
  CalendarDays,
  AlertTriangle,
} from "lucide-react"
import { getChapterTypeMeta, isGradableChapterType } from "@/lib/chapterTypes"

function ChapterTypeBadge({ type }: { type: string }) {
  const meta = getChapterTypeMeta(type)
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

export default function ModuleView() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const [module, setModule] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!courseId || !moduleId) {
        setLoading(false)
        setError("Invalid course or module link.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const mod = await coursesService.getModule(courseId, moduleId)
        if (cancelled) return
        setModule(mod)

        try {
          const completedChapterIds = await coursesService.getMyChapterProgress(courseId)
          if (!cancelled) setCompletedIds(new Set(completedChapterIds))
        } catch {
          // non-critical
        }
      } catch {
        if (!cancelled) setError("Failed to load module. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [courseId, moduleId])

  const sortedChapters = useMemo(
    () => [...(module?.chapters ?? [])].sort((a, b) => a.order_index - b.order_index),
    [module],
  )

  const gradableChapters = sortedChapters.filter((c) => isGradableChapterType(c.chapter_type))
  const allComplete = gradableChapters.length > 0 && gradableChapters.every((c) => completedIds.has(c.id))

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="h-8 w-28 animate-pulse bg-muted rounded mb-4" />
        <div className="mb-4 space-y-2">
          <div className="h-7 w-2/3 animate-pulse bg-muted rounded" />
          <div className="h-4 w-full animate-pulse bg-muted rounded" />
        </div>
        <div className="h-2 w-full animate-pulse bg-muted rounded-full mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !module) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Book className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">
          {error ?? "Module not found"}
        </h2>
        <Link to={courseId ? `/courses/${courseId}` : "/"}>
          <Button variant="outline" size="sm">Back to Course</Button>
        </Link>
      </div>
    )
  }

  const completedCount = gradableChapters.filter((c) => completedIds.has(c.id)).length
  const progressPercent = gradableChapters.length > 0 ? Math.round((completedCount / gradableChapters.length) * 100) : 100

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <Link to={`/courses/${courseId}`}>
        <Button variant="ghost" size="sm" className="mb-4 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Course
        </Button>
      </Link>

      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">{module.title}</h1>
        {module.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{module.description}</p>
        )}
      </div>

      {module.due_date && (() => {
        const dueDate = new Date(module.due_date)
        const now = new Date()
        const isOverdue = dueDate < now && !allComplete
        const isUpcoming = !isOverdue && dueDate.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000
        return (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md border mb-4 ${
            isOverdue
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
              : isUpcoming
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                : "bg-muted/50 border-border"
          }`}>
            {isOverdue ? (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            ) : (
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className={`text-sm font-medium ${
              isOverdue ? "text-red-700 dark:text-red-400" : isUpcoming ? "text-amber-700 dark:text-amber-400" : "text-foreground"
            }`}>
              {isOverdue ? "Overdue" : "Due"}: {dueDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              {" at "}{dueDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )
      })()}

      {allComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 mb-4">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Module complete — well done!</span>
        </div>
      )}

      {gradableChapters.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">
              {completedCount}/{gradableChapters.length} completed
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Book className="h-4 w-4" />
          Chapters
          <span className="text-sm font-normal text-muted-foreground">
            ({sortedChapters.length})
          </span>
        </h2>

        {sortedChapters.length > 0 ? (
          <div className="space-y-3">
            {sortedChapters.map((chapter, idx) => {
              const isGradable = isGradableChapterType(chapter.chapter_type)
              const isCompleted = isGradable && completedIds.has(chapter.id)
              const requiresTeacher = chapter.requires_completion
              const prevChapter = idx > 0 ? sortedChapters[idx - 1] : null
              const prevIsGradable = prevChapter ? isGradableChapterType(prevChapter.chapter_type) : false
              const isLocked = chapter.is_locked && prevChapter != null && prevIsGradable && !completedIds.has(prevChapter.id)

              if (isLocked) {
                return (
                  <Card
                    key={chapter.id}
                    className="animate-fade-in opacity-60 cursor-not-allowed"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                        <span className="text-muted-foreground">{chapter.title}</span>
                        {chapter.chapter_type && (
                          <ChapterTypeBadge type={chapter.chapter_type} />
                        )}
                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground/30 shrink-0" />
                      </CardTitle>
                    </CardHeader>
                  </Card>
                )
              }

              return (
                <Link
                  key={chapter.id}
                  to={`/courses/${courseId}/modules/${moduleId}/chapters/${chapter.id}`}
                  className="block"
                >
                  <Card
                    className={`animate-fade-in transition-colors hover:border-primary/40 hover:shadow-sm ${isCompleted ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10" : ""}`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        {isGradable ? (
                          isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                          ) : requiresTeacher ? (
                            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                          )
                        ) : null}
                        <span className={isCompleted ? "text-muted-foreground" : ""}>
                          {chapter.title}
                        </span>
                        {chapter.chapter_type && (
                          <ChapterTypeBadge type={chapter.chapter_type} />
                        )}
                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground/40 shrink-0" />
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No chapters added yet
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  )
}
