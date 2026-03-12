import { useEffect, useState, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { Module, ChapterProgress } from "@/types"
import {
  ArrowLeft,
  Book,
  CheckCircle,
  Circle,
  ChevronRight,
  Lock,
  FileText,
  HelpCircle,
  ClipboardList,
  PlayCircle,
  Headphones,
  MessageSquare,
  Layers,
} from "lucide-react"

const CHAPTER_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  reading: { label: "Reading", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  content: { label: "Content", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  video: { label: "Video", icon: PlayCircle, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  audio: { label: "Audio", icon: Headphones, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  quiz: { label: "Quiz", icon: HelpCircle, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  assignment: { label: "Assignment", icon: ClipboardList, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  discussion: { label: "Discussion", icon: MessageSquare, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  mixed: { label: "Mixed", icon: Layers, color: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400" },
}

function ChapterTypeBadge({ type }: { type: string }) {
  const config = CHAPTER_TYPE_CONFIG[type] ?? CHAPTER_TYPE_CONFIG.content
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
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
    const load = async () => {
      if (!courseId || !moduleId) return
      setError(null)
      try {
        const mod = await coursesService.getModule(courseId, moduleId)
        setModule(mod)

        const chapterIds = (mod.chapters ?? []).map((c) => c.id)
        if (chapterIds.length > 0) {
          try {
            const progress = await coursesService.getChapterProgress(chapterIds)
            setCompletedIds(new Set(progress.map((p: ChapterProgress) => p.chapter_id)))
          } catch {
            // non-critical
          }
        }
      } catch {
        setError("Failed to load module. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId, moduleId])

  const sortedChapters = useMemo(
    () => [...(module?.chapters ?? [])].sort((a, b) => a.order_index - b.order_index),
    [module],
  )

  const allComplete = sortedChapters.length > 0 && sortedChapters.every((c) => completedIds.has(c.id))

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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

  const completedCount = sortedChapters.filter((c) => completedIds.has(c.id)).length
  const progressPercent = sortedChapters.length > 0 ? Math.round((completedCount / sortedChapters.length) * 100) : 0

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

      {allComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 mb-4">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Module complete — well done!</span>
        </div>
      )}

      {sortedChapters.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">
              {completedCount}/{sortedChapters.length} chapters
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
              const isCompleted = completedIds.has(chapter.id)
              const requiresTeacher = chapter.requires_completion
              const isLocked = chapter.is_locked && idx > 0 && !completedIds.has(sortedChapters[idx - 1].id)

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
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        ) : requiresTeacher ? (
                          <Lock className="h-5 w-5 text-amber-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
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
