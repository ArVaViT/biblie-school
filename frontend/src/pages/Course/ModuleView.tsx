import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import DOMPurify from "dompurify"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import type { Module, Chapter, ChapterProgress, ChapterBlock } from "@/types"
import {
  ArrowLeft,
  Book,
  CheckCircle,
  Circle,
  Download,
  Paperclip,

  ChevronDown,
  ChevronRight,
  Lock,
  FileText,
  HelpCircle,
  ClipboardList,
  File,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
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

const CHAPTER_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  content: { label: "Content", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  quiz: { label: "Quiz", icon: HelpCircle, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  assignment: { label: "Assignment", icon: ClipboardList, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  mixed: { label: "Mixed", icon: Book, color: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400" },
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

function BlockRenderer({ block }: { block: ChapterBlock }) {
  switch (block.block_type) {
    case "text":
      return block.content ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.content) }}
        />
      ) : null

    case "video": {
      const videoId = block.video_url ? extractYouTubeId(block.video_url) : null
      return videoId ? (
        <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null
    }

    case "quiz":
      return block.quiz_id ? <QuizTaker chapterId={block.chapter_id} /> : null

    case "assignment":
      return block.assignment_id ? <AssignmentPanel chapterId={block.chapter_id} /> : null

    case "file":
      return block.file_url ? (
        <a
          href={block.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          <File className="h-4 w-4 text-muted-foreground" />
          <span>{block.content || "Download file"}</span>
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      ) : null

    default:
      return null
  }
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
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [chapterBlocks, setChapterBlocks] = useState<Record<string, ChapterBlock[]>>({})
  const [loadingBlocks, setLoadingBlocks] = useState<Set<string>>(new Set())

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

        try {
          const files = await storageService.listCourseMaterials(courseId)
          setMaterials(files)
        } catch {
          // non-critical
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

  const loadBlocks = useCallback(async (chapterId: string) => {
    if (chapterBlocks[chapterId] || loadingBlocks.has(chapterId)) return
    setLoadingBlocks((prev) => new Set(prev).add(chapterId))
    try {
      const blocks = await coursesService.getChapterBlocks(chapterId)
      setChapterBlocks((prev) => ({ ...prev, [chapterId]: blocks.sort((a: ChapterBlock, b: ChapterBlock) => a.order_index - b.order_index) }))
    } catch {
      setChapterBlocks((prev) => ({ ...prev, [chapterId]: [] }))
    } finally {
      setLoadingBlocks((prev) => {
        const next = new Set(prev)
        next.delete(chapterId)
        return next
      })
    }
  }, [chapterBlocks, loadingBlocks])

  const toggleExpanded = useCallback((chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
        loadBlocks(chapterId)
      }
      return next
    })
  }, [loadBlocks])

  const toggleChapter = useCallback(
    async (chapter: Chapter) => {
      if (!courseId || togglingIds.has(chapter.id)) return
      if (chapter.requires_completion) return

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

        const updatedCompleted = wasCompleted
          ? new Set([...completedIds].filter((id) => id !== chapter.id))
          : new Set([...completedIds, chapter.id])

        const total = sortedChapters.length
        const completedCount = updatedCompleted.size
        const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0
        if (courseId) {
          await coursesService.updateProgress(courseId, progress)
        }
      } catch {
        toast({ title: "Failed to update chapter progress", variant: "destructive" })
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
    } catch {
      toast({ title: "Failed to download file", variant: "destructive" })
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

      {allComplete && (
        <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center mb-8">
          <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <h3 className="font-serif text-lg font-semibold text-emerald-800 dark:text-emerald-300">Module Complete</h3>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">Well done. You have completed all chapters in this module.</p>
        </div>
      )}

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

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Book className="h-5 w-5" />
          Chapters
          <span className="text-sm font-normal text-muted-foreground">
            ({sortedChapters.length})
          </span>
        </h2>

        {sortedChapters.length > 0 ? (
          <div className="space-y-3">
            {sortedChapters.map((chapter, idx) => {
              const isCompleted = completedIds.has(chapter.id)
              const isToggling = togglingIds.has(chapter.id)
              const isExpanded = expandedChapters.has(chapter.id)
              const blocks = chapterBlocks[chapter.id]
              const isLoadingBlocks = loadingBlocks.has(chapter.id)
              const hasBlocks = blocks && blocks.length > 0
              const requiresTeacher = chapter.requires_completion

              return (
                <Card
                  key={chapter.id}
                  className={`animate-fade-in transition-colors ${isCompleted ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10" : ""}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <CardHeader
                    className="pb-2 cursor-pointer select-none"
                    onClick={() => toggleExpanded(chapter.id)}
                  >
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
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
                    </CardTitle>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 ml-8 space-y-4">
                      {isLoadingBlocks && (
                        <div className="flex justify-center py-4">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      )}

                      {hasBlocks ? (
                        <div className="space-y-4">
                          {blocks.map((block) => (
                            <BlockRenderer key={block.id} block={block} />
                          ))}
                        </div>
                      ) : !isLoadingBlocks && (
                        <>
                          {chapter.video_url && (() => {
                            const videoId = extractYouTubeId(chapter.video_url!)
                            return videoId ? (
                              <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
                                <iframe
                                  className="absolute inset-0 h-full w-full"
                                  src={`https://www.youtube.com/embed/${videoId}`}
                                  title={chapter.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : null
                          })()}

                          {chapter.content && (
                            <div
                              className="prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chapter.content ?? "") }}
                            />
                          )}
                        </>
                      )}

                      <StudentNotes chapterId={chapter.id} />

                      {!hasBlocks && (
                        <>
                          <QuizTaker chapterId={chapter.id} />
                          <AssignmentPanel chapterId={chapter.id} />
                        </>
                      )}

                      {/* Completion toggle */}
                      <div className="pt-2 border-t">
                        {requiresTeacher ? (
                          isCompleted ? (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Marked complete by your instructor
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <Lock className="h-3.5 w-3.5" />
                              This chapter will be marked complete by your instructor.
                            </p>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleChapter(chapter)
                            }}
                            disabled={isToggling}
                            className="flex items-center gap-2 text-xs transition-colors hover:text-primary disabled:opacity-50"
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-green-600 dark:text-green-400">Completed — click to undo</span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-4 w-4 text-muted-foreground/40" />
                                <span>Mark as complete</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </CardContent>
                  )}
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
