import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RichTextEditor from "@/components/editor/RichTextEditor"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import type { Course, Module, Chapter } from "@/types"
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  GripVertical, FileText, Save, Upload, Image, Paperclip,
  Download, Loader2, X, Video,
} from "lucide-react"

interface MaterialFile {
  name: string
  path: string
  size?: number
  created?: string
}

export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  const [showDetails, setShowDetails] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [editingChapter, setEditingChapter] = useState<string | null>(null)
  const [chapterContent, setChapterContent] = useState("")
  const [chapterVideoUrl, setChapterVideoUrl] = useState("")

  const [uploadingCover, setUploadingCover] = useState(false)
  const [materials, setMaterials] = useState<MaterialFile[]>([])
  const [uploadingMaterial, setUploadingMaterial] = useState(false)

  const coverRef = useRef<HTMLInputElement>(null)
  const materialRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!courseId) return
    try {
      const data = await coursesService.getCourse(courseId)
      setCourse(data)
      setTitle(data.title)
      setDescription(data.description ?? "")
      setImageUrl(data.image_url ?? "")

      const files = await storageService.listCourseMaterials(courseId).catch(() => [])
      setMaterials(files)
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !courseId) return
    setUploadingCover(true)
    try {
      const url = await storageService.uploadCourseImage(courseId, file)
      setImageUrl(url)
      await coursesService.updateCourse(courseId, { image_url: url })
    } catch (err) {
      console.error("Cover upload failed:", err)
    } finally {
      setUploadingCover(false)
      if (coverRef.current) coverRef.current.value = ""
    }
  }

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !courseId) return
    setUploadingMaterial(true)
    try {
      await storageService.uploadCourseMaterial(courseId, file)
      const files = await storageService.listCourseMaterials(courseId)
      setMaterials(files)
    } catch (err) {
      console.error("Material upload failed:", err)
    } finally {
      setUploadingMaterial(false)
      if (materialRef.current) materialRef.current.value = ""
    }
  }

  const downloadMaterial = async (mat: MaterialFile) => {
    try {
      const url = await storageService.getSignedMaterialUrl(mat.path)
      window.open(url, "_blank")
    } catch (err) {
      console.error("Download failed:", err)
    }
  }

  const deleteMaterial = async (mat: MaterialFile) => {
    if (!confirm(`Delete "${mat.name}"?`)) return
    try {
      await storageService.deleteCourseMaterial(mat.path)
      setMaterials((prev) => prev.filter((m) => m.path !== mat.path))
    } catch (err) {
      console.error("Delete failed:", err)
    }
  }

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
  }

  const removeModule = async (modId: string) => {
    if (!courseId || !confirm("Delete this module and all its chapters?")) return
    await coursesService.deleteModule(courseId, modId)
    setCourse((prev) =>
      prev ? { ...prev, modules: prev.modules?.filter((m) => m.id !== modId) } : prev,
    )
  }

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
      video_url: chapterVideoUrl.trim() || undefined,
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
                      c.id === ch.id ? { ...c, content: chapterContent, video_url: chapterVideoUrl.trim() || null } : c,
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

      {/* Course details — collapsible */}
      <Card className="mb-8">
        <div
          className="flex items-center justify-between p-6 cursor-pointer select-none"
          onClick={() => setShowDetails(!showDetails)}
        >
          <CardTitle className="text-lg">Course Details</CardTitle>
          <div className="flex items-center gap-2">
            {!showDetails && (
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">{title}</span>
            )}
            {showDetails ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {showDetails && (
        <CardContent className="space-y-4 pt-0">
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

          {/* Cover image */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            {imageUrl ? (
              <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <span className="text-white text-sm font-medium flex items-center gap-1.5">
                      <Image className="h-4 w-4" /> Change Cover
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                disabled={uploadingCover}
                className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                {uploadingCover ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">Upload cover image</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={coverRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleCoverUpload}
            />
          </div>

          <Button onClick={saveCourse} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
        )}
      </Card>

      {/* Course Materials */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Course Materials</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => materialRef.current?.click()}
              disabled={uploadingMaterial}
            >
              {uploadingMaterial ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4 mr-1.5" />
              )}
              Upload File
            </Button>
            <input
              ref={materialRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp3,.wav,.ogg,.mp4"
              className="hidden"
              onChange={handleMaterialUpload}
            />
          </div>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No materials uploaded yet. Upload PDFs, documents, or audio files.
            </p>
          ) : (
            <div className="space-y-2">
              {materials.map((mat) => (
                <div
                  key={mat.path}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{mat.name}</span>
                  {mat.size && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(mat.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => downloadMaterial(mat)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteMaterial(mat)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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
                                    setChapterVideoUrl(ch.video_url ?? "")
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
                              <div className="mt-3 space-y-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs flex items-center gap-1.5">
                                    <Video className="h-3.5 w-3.5" />
                                    YouTube Video URL (optional)
                                  </Label>
                                  <Input
                                    value={chapterVideoUrl}
                                    onChange={(e) => setChapterVideoUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Content</Label>
                                  <RichTextEditor
                                    content={chapterContent}
                                    onChange={setChapterContent}
                                    placeholder="Write chapter content here..."
                                  />
                                </div>
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
