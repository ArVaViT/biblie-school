import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import type { Course, Announcement } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  Pencil, Calendar, Megaphone, Plus, Trash2, ArrowLeft, GripVertical,
  Layers, Save, Upload, Image, Loader2, X, Eye, EyeOff, BookOpen,
  Settings, Download, Paperclip,
} from "lucide-react"

interface MaterialFile { name: string; path: string; size?: number }

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function StatusBadge({ start, end }: { start: string; end: string }) {
  if (!start && !end) return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not set</span>
  const now = new Date(), s = start ? new Date(start) : null, e = end ? new Date(end) : null
  if (s && now < s) return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">Upcoming</span>
  if (e && now > e) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Closed</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Open</span>
}

const ta = "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)
  const [enrollStart, setEnrollStart] = useState("")
  const [enrollEnd, setEnrollEnd] = useState("")
  const [anns, setAnns] = useState<Announcement[]>([])
  const [annTitle, setAnnTitle] = useState("")
  const [annContent, setAnnContent] = useState("")
  const [postingAnn, setPostingAnn] = useState(false)
  const [mats, setMats] = useState<MaterialFile[]>([])
  const [uploadingMat, setUploadingMat] = useState(false)
  const matRef = useRef<HTMLInputElement>(null)
  const [modal, setModal] = useState<"details" | "enroll" | "announce" | "materials" | null>(null)

  const load = useCallback(async () => {
    if (!courseId) return
    try {
      const d = await coursesService.getCourse(courseId)
      setCourse(d); setTitle(d.title); setDescription(d.description ?? ""); setImageUrl(d.image_url ?? "")
      setEnrollStart(d.enrollment_start?.slice(0, 16) ?? ""); setEnrollEnd(d.enrollment_end?.slice(0, 16) ?? "")
      setMats(await storageService.listCourseMaterials(courseId).catch(() => []))
      setAnns(await coursesService.getAnnouncements(courseId).catch(() => []))
    } catch { navigate("/teacher") } finally { setLoading(false) }
  }, [courseId, navigate])

  useEffect(() => { load() }, [load])

  const saveDetails = async () => {
    if (!courseId || !title.trim()) return
    setSaving(true)
    try {
      const u = await coursesService.updateCourse(courseId, { title: title.trim(), description: description.trim() || undefined, image_url: imageUrl.trim() || undefined })
      setCourse(p => p ? { ...p, ...u } : p); toast({ title: "Saved", variant: "success" }); setModal(null)
    } catch { toast({ title: "Failed to save", variant: "destructive" }) } finally { setSaving(false) }
  }

  const saveEnrollment = async () => {
    if (!courseId) return
    setSaving(true)
    try {
      await coursesService.updateCourse(courseId, { enrollment_start: enrollStart ? new Date(enrollStart).toISOString() : null, enrollment_end: enrollEnd ? new Date(enrollEnd).toISOString() : null })
      toast({ title: "Enrollment saved", variant: "success" }); setModal(null)
    } catch { toast({ title: "Failed to save", variant: "destructive" }) } finally { setSaving(false) }
  }

  const togglePublish = async () => {
    if (!courseId || !course) return
    const next = course.status === "published" ? "draft" as const : "published" as const
    try {
      await coursesService.updateCourse(courseId, { status: next })
      setCourse(p => p ? { ...p, status: next } : p)
      toast({ title: next === "published" ? "Published" : "Unpublished", variant: "success" })
    } catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !courseId) return
    setUploadingCover(true)
    try {
      const url = await storageService.uploadCourseImage(courseId, file)
      setImageUrl(url); await coursesService.updateCourse(courseId, { image_url: url })
      setCourse(p => p ? { ...p, image_url: url } : p)
    } catch { toast({ title: "Upload failed", variant: "destructive" }) }
    finally { setUploadingCover(false); if (coverRef.current) coverRef.current.value = "" }
  }

  const addModule = async () => {
    if (!courseId) return
    const order = course?.modules?.length ?? 0
    try {
      const m = await coursesService.createModule(courseId, { title: `Module ${order + 1}`, order_index: order })
      setCourse(p => p ? { ...p, modules: [...(p.modules ?? []), { ...m, chapters: [] }] } : p)
      toast({ title: "Module added", variant: "success" })
    } catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  const removeModule = async (id: string) => {
    if (!courseId || !confirm("Delete this module and all its chapters?")) return
    try {
      await coursesService.deleteModule(courseId, id)
      setCourse(p => p ? { ...p, modules: p.modules?.filter(m => m.id !== id) } : p)
    } catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  const postAnnouncement = async () => {
    if (!courseId || !annTitle.trim()) return
    setPostingAnn(true)
    try {
      const a = await coursesService.createAnnouncement({ title: annTitle.trim(), content: annContent.trim(), course_id: courseId })
      setAnns(p => [a, ...p]); setAnnTitle(""); setAnnContent("")
    } catch { toast({ title: "Failed", variant: "destructive" }) } finally { setPostingAnn(false) }
  }

  const deleteAnn = async (id: string) => {
    if (!confirm("Delete this announcement?")) return
    try { await coursesService.deleteAnnouncement(id); setAnns(p => p.filter(a => a.id !== id)) }
    catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  const handleMatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !courseId) return
    setUploadingMat(true)
    try { await storageService.uploadCourseMaterial(courseId, file); setMats(await storageService.listCourseMaterials(courseId)) }
    catch { toast({ title: "Upload failed", variant: "destructive" }) }
    finally { setUploadingMat(false); if (matRef.current) matRef.current.value = "" }
  }

  const dlMat = async (m: MaterialFile) => {
    try { window.open(await storageService.getSignedMaterialUrl(m.path), "_blank") }
    catch { toast({ title: "Download failed", variant: "destructive" }) }
  }

  const delMat = async (m: MaterialFile) => {
    if (!confirm(`Delete "${m.name}"?`)) return
    try { await storageService.deleteCourseMaterial(m.path); setMats(p => p.filter(x => x.path !== m.path)) }
    catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!course) return null
  const modules = [...(course.modules ?? [])].sort((a, b) => a.order_index - b.order_index)
  const pub = course.status === "published"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/teacher")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Courses
      </Button>

      {/* Course Header */}
      <div className="rounded-xl overflow-hidden border mb-8">
        <div className="h-48 bg-muted">
          {course.image_url
            ? <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5"><BookOpen className="h-16 w-16 text-primary/20" /></div>}
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold tracking-tight truncate">{course.title}</h1>
              {course.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>}
            </div>
            <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${pub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>
              {pub ? "Published" : "Draft"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setModal("details")} title="Edit details"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="sm" onClick={() => setModal("enroll")} title="Enrollment"><Calendar className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="sm" onClick={() => setModal("announce")} title="Announcements"><Megaphone className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="sm" onClick={() => setModal("materials")} title="Materials"><Settings className="h-3.5 w-3.5" /></Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={togglePublish}>
              {pub ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}{pub ? "Unpublish" : "Publish"}
            </Button>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2"><Layers className="h-5 w-5 text-primary/60" />Modules</h2>
        <Button onClick={addModule} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1.5" />Add Module</Button>
      </div>

      {modules.length === 0 ? (
        <Card className="border-dashed p-12 text-center text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" /><p>No modules yet. Add your first module to start building.</p>
        </Card>
      ) : (
        <div className="space-y-2">{modules.map((mod, i) => (
          <Card key={mod.id} className="group flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer"
            onClick={() => navigate(`/teacher/courses/${courseId}/modules/${mod.id}/edit`)}>
            <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
            <span className="text-xs font-mono text-muted-foreground/50 w-6 text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{mod.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mod.chapters?.length ?? 0} chapter{(mod.chapters?.length ?? 0) !== 1 ? "s" : ""}</p>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0 transition-opacity"
              onClick={e => { e.stopPropagation(); removeModule(mod.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </Card>
        ))}</div>
      )}

      {/* Edit Details Modal */}
      <Modal open={modal === "details"} onClose={() => setModal(null)} title="Edit Course Details">
        <div className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label>
            <textarea className={ta} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Cover Image</Label>
            {imageUrl ? (
              <div className="relative w-full h-36 rounded-lg overflow-hidden border">
                <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
                <button type="button" onClick={() => coverRef.current?.click()} className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingCover ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <span className="text-white text-sm flex items-center gap-1.5"><Image className="h-4 w-4" />Change</span>}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => coverRef.current?.click()} disabled={uploadingCover}
                className="w-full h-28 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground">
                {uploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Upload className="h-5 w-5" /><span className="text-sm">Upload cover</span></>}
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>
          <Button onClick={saveDetails} disabled={saving || !title.trim()} className="w-full">
            <Save className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Save Details"}
          </Button>
        </div>
      </Modal>

      {/* Enrollment Modal */}
      <Modal open={modal === "enroll"} onClose={() => setModal(null)} title="Enrollment Period">
        <div className="space-y-4">
          <div className="flex items-center justify-between"><Label className="font-medium">Status</Label><StatusBadge start={enrollStart} end={enrollEnd} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">Start</Label><Input type="datetime-local" value={enrollStart} onChange={e => setEnrollStart(e.target.value)} className="text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs">End</Label><Input type="datetime-local" value={enrollEnd} onChange={e => setEnrollEnd(e.target.value)} className="text-sm" /></div>
          </div>
          <Button onClick={saveEnrollment} disabled={saving} className="w-full"><Save className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Save"}</Button>
        </div>
      </Modal>

      {/* Announcements Modal */}
      <Modal open={modal === "announce"} onClose={() => setModal(null)} title="Announcements">
        <div className="space-y-4">
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <Input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title" />
            <textarea className={ta + " min-h-[60px]"} value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Content (optional)" />
            <Button size="sm" onClick={postAnnouncement} disabled={postingAnn || !annTitle.trim()}>
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />{postingAnn ? "Posting…" : "Post"}
            </Button>
          </div>
          {anns.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">No announcements yet.</p>
            : <div className="space-y-2 max-h-60 overflow-y-auto">{anns.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Megaphone className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.content && <p className="text-xs text-muted-foreground mt-0.5">{a.content}</p>}
                    <time className="text-[10px] text-muted-foreground/60 mt-1 block">{new Date(a.created_at).toLocaleDateString()}</time>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => deleteAnn(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}</div>}
        </div>
      </Modal>

      {/* Materials Modal */}
      <Modal open={modal === "materials"} onClose={() => setModal(null)} title="Course Materials">
        <div className="space-y-4">
          <Button variant="outline" size="sm" className="w-full" onClick={() => matRef.current?.click()} disabled={uploadingMat}>
            {uploadingMat ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1.5" />}Upload File
          </Button>
          <input ref={matRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp3,.wav,.ogg,.mp4" className="hidden" onChange={handleMatUpload} />
          {mats.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">No materials uploaded yet.</p>
            : <div className="space-y-2 max-h-60 overflow-y-auto">{mats.map(m => (
                <div key={m.path} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{m.name}</span>
                  {m.size && <span className="text-xs text-muted-foreground shrink-0">{(m.size / 1024).toFixed(0)} KB</span>}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => dlMat(m)}><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => delMat(m)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}</div>}
        </div>
      </Modal>
    </div>
  )
}
