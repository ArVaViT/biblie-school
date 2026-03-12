import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import DOMPurify from "dompurify"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import type { Module, Chapter, ChapterProgress } from "@/types"
import {
  ArrowLeft,
  Book,
  CheckCircle,
  Circle,
  Download,
  Paperclip,
  Trophy,
} from "lucide-react"
import StudentNotes from "@/components/course/StudentNotes"
import QuizTaker from "@/components/quiz/QuizTaker"
import AssignmentPanel from "@/components/assignment/AssignmentPanel"

interface CourseMaterial {
  name: string
  path: string
  size?: number
  created: string
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export default function ModuleView() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const [module, setModule] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)

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
            // Progress may fail if not logged in — non-critical
          }
        }

        try {
          const files = await storageService.listCourseMaterials(courseId)
          setMaterials(files)
        } catch {
          // Materials may fail if not enrolled — non-critical
        }
      } catch (err) {
        console.error("Failed to load module:", err)
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

  const toggleChapter = useCallback(
    async (chapter: Chapter) => {
      if (!courseId || togglingIds.has(chapter.id)) return
      setTogglingIds((prev) => new Set(prev).add(chapter.id))

      const wasCompleted = completedIds.has(chapter.id)
      try {
        if (wasCompleted) {
          await coursesService.unmarkChapterComplete(chapter.id)
          setCompletedIds((prev) => {
            const next = new Set(prev)
            next.delete(chapter.id)
            return next
          })
        } else {
          await coursesService.markChapterComplete(chapter.id)
          setCompletedIds((prev) => new Set(prev).add(chapter.id))
        }

        // After toggling, check if all chapters are now complete
        const updatedCompleted = wasCompleted
          ? new Set([...completedIds].filter((id) => id !== chapter.id))
          : new Set([...completedIds, chapter.id])

        const total = sortedChapters.length
        if (total > 0 && sortedChapters.every((c) => updatedCompleted.has(c.id))) {
          await coursesService.updateProgress(courseId, 100)
        }
      } catch (error) {
        console.error("Failed to update chapter progress:", error)
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev)
          next.delete(chapter.id)
          return next
        })
      }
    },
    [courseId, completedIds, togglingIds, sortedChapters],
  )

  const handleDownload = useCallback(async (path: string) => {
    setDownloadingPath(path)
    try {
      const url = await storageService.getSignedMaterialUrl(path)
      window.open(url, "_blank")
    } catch (error) {
      console.error("Failed to get download URL:", error)
    } finally {
      setDownloadingPath(null)
    }
  }, [])

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
        <Link to={courseId ? `/courses/${courseId}` : "/dashboard"}>
          <Button variant="outline" size="sm">Back to Course</Button>
        </Link>
      </div>
    )
  }

  const completedCount = sortedChapters.filter((c) => completedIds.has(c.id)).length
  const progressPercent = sortedChapters.length > 0 ? Math.round((completedCount / sortedChapters.length) * 100) : 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link to={`/courses/${courseId}`}>
        <Button variant="ghost" size="sm" className="mb-6 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Course
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{module.title}</h1>
        {module.description && (
          <p className="text-muted-foreground leading-relaxed">{module.description}</p>
        )}
      </div>

      {/* Completion celebration */}
      {allComplete && (
        <div className="mb-8 rounded-xl border-2 border-green-500/30 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-6 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-green-600 dark:text-green-400" />
            <h2 className="text-xl font-bold text-green-700 dark:text-green-300">
              Congratulations! You've completed this module!
            </h2>
            <Trophy className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-green-600 dark:text-green-400">
            All {sortedChapters.length} chapters finished
          </p>
          <div className="mt-3 flex justify-center gap-1">
            {["🎉", "✨", "🌟", "🎊", "💫"].map((emoji, i) => (
              <span
                key={i}
                className="text-2xl animate-bounce"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {emoji}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {sortedChapters.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">
              {completedCount} of {sortedChapters.length} chapters completed
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Chapters */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Book className="h-5 w-5" />
          Chapters
          <span className="text-sm font-normal text-muted-foreground">
            ({sortedChapters.length})
          </span>
        </h2>

        {sortedChapters.length > 0 ? (
          <div className="space-y-4">
            {sortedChapters.map((chapter, idx) => {
              const isCompleted = completedIds.has(chapter.id)
              const isToggling = togglingIds.has(chapter.id)
              const videoId = chapter.video_url ? extractYouTubeId(chapter.video_url) : null

              return (
                <Card
                  key={chapter.id}
                  className={`animate-fade-in transition-colors ${isCompleted ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10" : ""}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleChapter(chapter)}
                        disabled={isToggling}
                        className="shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                        aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </button>
                      <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
                        {chapter.title}
                      </span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0 ml-8 space-y-4">
                    {videoId && (
                      <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
                        <iframe
                          className="absolute inset-0 h-full w-full"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title={chapter.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {chapter.content && (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chapter.content ?? "") }}
                      />
                    )}

                    <StudentNotes chapterId={chapter.id} />
                    <QuizTaker chapterId={chapter.id} />
                    <AssignmentPanel chapterId={chapter.id} />
                  </CardContent>
                </Card>
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

      {/* Course Materials */}
      {materials.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Course Materials
            <span className="text-sm font-normal text-muted-foreground">
              ({materials.length})
            </span>
          </h2>

          <Card>
            <CardContent className="p-0 divide-y">
              {materials.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 text-xs"
                    disabled={downloadingPath === file.path}
                    onClick={() => handleDownload(file.path)}
                  >
                    {downloadingPath === file.path ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
