import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coursesService } from "@/services/courses"
import type { Course, Module, Chapter } from "@/types"
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  GripVertical, FileText, Save,
} from "lucide-react"

export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [editingChapter, setEditingChapter] = useState<string | null>(null)
  const [chapterContent, setChapterContent] = useState("")

  const load = useCallback(async () => {
    if (!courseId) return
    try {
      const data = await coursesService.getCourse(courseId)
      setCourse(data)
      setTitle(data.title)
      setDescription(data.description ?? "")
      setImageUrl(data.image_url ?? "")
    } catch {
      navigate("/teacher")
    } finally {
      setLoading(false)
    }
  }, [courseId, navigate])

  useEffect(() => {
    load()
  }, [load])

  const saveCourse = async () => {
    if (!courseId || !title.trim()) return
    setSaving(true)
    try {
      await coursesService.updateCourse(courseId, {
        title: title.trim(),
        description: description.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // --- Module CRUD ---
  const addModule = async () => {
    if (!courseId) return
    const order = (course?.modules?.length ?? 0)
    const mod = await coursesService.createModule(courseId, {
      title: `Module ${order + 1}`,
      order_index: order,
    })
    setCourse((prev) =>
      prev ? { ...prev, modules: [...(prev.modules ?? []), { ...mod, chapters: [] }] } : prev,
    )
    setExpandedModules((prev) => new Set(prev).add(mod.id))
  }

  const renameModule = async (mod: Module, newTitle: string) => {
    if (!courseId || !newTitle.trim()) return
    await coursesService.updateModule(courseId, mod.id, { title: newTitle.trim() })
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            modules: prev.modules?.map((m) =>
              m.id === mod.id ? { ...m, title: newTitle.trim() } : m,
            ),
          }
        : prev,
    )
  }

  const removeModule = async (modId: string) => {
    if (!courseId || !confirm("Delete this module and all its chapters?")) return
    await coursesService.deleteModule(courseId, modId)
    setCourse((prev) =>
      prev ? { ...prev, modules: prev.modules?.filter((m) => m.id !== modId) } : prev,
    )
  }

  // --- Chapter CRUD ---
  const addChapter = async (mod: Module) => {
    if (!courseId) return
    const order = (mod.chapters?.length ?? 0)
    const ch = await coursesService.createChapter(courseId, mod.id, {
      title: `Chapter ${order + 1}`,
      order_index: order,
    })
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            modules: prev.modules?.map((m) =>
              m.id === mod.id ? { ...m, chapters: [...(m.chapters ?? []), ch] } : m,
            ),
          }
        : prev,
    )
  }

  const saveChapter = async (mod: Module, ch: Chapter) => {
    if (!courseId) return
    await coursesService.updateChapter(courseId, mod.id, ch.id, {
      content: chapterContent,
    })
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            modules: prev.modules?.map((m) =>
              m.id === mod.id
                ? {
                    ...m,
                    chapters: m.chapters?.map((c) =>
                      c.id === ch.id ? { ...c, content: chapterContent } : c,
                    ),
                  }
                : m,
            ),
          }
        : prev,
    )
    setEditingChapter(null)
  }

  const renameChapter = async (mod: Module, ch: Chapter, newTitle: string) => {
    if (!courseId || !newTitle.trim()) return
    await coursesService.updateChapter(courseId, mod.id, ch.id, { title: newTitle.trim() })
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            modules: prev.modules?.map((m) =>
              m.id === mod.id
                ? {
                    ...m,
                    chapters: m.chapters?.map((c) =>
                      c.id === ch.id ? { ...c, title: newTitle.trim() } : c,
                    ),
                  }
                : m,
            ),
          }
        : prev,
    )
  }

  const removeChapter = async (mod: Module, chId: string) => {
    if (!courseId) return
    await coursesService.deleteChapter(courseId, mod.id, chId)
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            modules: prev.modules?.map((m) =>
              m.id === mod.id
                ? { ...m, chapters: m.chapters?.filter((c) => c.id !== chId) }
                : m,
            ),
          }
        : prev,
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!course) return null

  const sortedModules = [...(course.modules ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/teacher")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back to Courses
      </Button>

      {/* Course details */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cover Image URL</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>
          <Button onClick={saveCourse} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Modules & Chapters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Modules & Chapters</h2>
        <Button onClick={addModule} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Module
        </Button>
      </div>

      {sortedModules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No modules yet. Add your first module to start building the course.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedModules.map((mod) => {
            const expanded = expandedModules.has(mod.id)
            const chapters = [...(mod.chapters ?? [])].sort(
              (a, b) => a.order_index - b.order_index,
            )
            return (
              <Card key={mod.id}>
                <div
                  className="flex items-center gap-2 p-4 cursor-pointer select-none"
                  onClick={() => toggleModule(mod.id)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <Input
                    value={mod.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const val = e.target.value
                      setCourse((prev) =>
                        prev
                          ? {
                              ...prev,
                              modules: prev.modules?.map((m) =>
                                m.id === mod.id ? { ...m, title: val } : m,
                              ),
                            }
                          : prev,
                      )
                    }}
                    onBlur={(e) => renameModule(mod, e.target.value)}
                    className="font-medium border-none shadow-none focus-visible:ring-1 h-8"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {chapters.length} ch.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeModule(mod.id)
                    }}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {expanded && (
                  <div className="border-t px-4 pb-4">
                    {chapters.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No chapters in this module
                      </p>
                    ) : (
                      <div className="space-y-2 mt-3">
                        {chapters.map((ch) => (
                          <div
                            key={ch.id}
                            className="rounded-md border bg-muted/30 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Input
                                value={ch.title}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setCourse((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          modules: prev.modules?.map((m) =>
                                            m.id === mod.id
                                              ? {
                                                  ...m,
                                                  chapters: m.chapters?.map((c) =>
                                                    c.id === ch.id
                                                      ? { ...c, title: val }
                                                      : c,
                                                  ),
                                                }
                                              : m,
                                          ),
                                        }
                                      : prev,
                                  )
                                }}
                                onBlur={(e) => renameChapter(mod, ch, e.target.value)}
                                className="border-none shadow-none focus-visible:ring-1 h-7 text-sm"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (editingChapter === ch.id) {
                                    setEditingChapter(null)
                                  } else {
                                    setEditingChapter(ch.id)
                                    setChapterContent(ch.content ?? "")
                                  }
                                }}
                                className="shrink-0 text-xs"
                              >
                                {editingChapter === ch.id ? "Close" : "Edit"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeChapter(mod, ch.id)}
                                className="text-destructive hover:text-destructive shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {editingChapter === ch.id && (
                              <div className="mt-3 space-y-2">
                                <textarea
                                  className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                                  value={chapterContent}
                                  onChange={(e) => setChapterContent(e.target.value)}
                                  placeholder="Write chapter content here... (HTML supported)"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => saveChapter(mod, ch)}
                                >
                                  <Save className="h-3.5 w-3.5 mr-1.5" />
                                  Save Content
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full border border-dashed"
                      onClick={() => addChapter(mod)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Chapter
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
