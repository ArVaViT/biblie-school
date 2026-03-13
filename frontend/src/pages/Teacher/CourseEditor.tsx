import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import type { Course, Announcement, Cohort, CourseEvent } from "@/types"
import { toast } from "@/hooks/use-toast"
import {
  Pencil, Calendar, Megaphone, Plus, Trash2,
  Layers, Save, Upload, Image, Loader2, X, Eye, EyeOff, BookOpen, ChevronRight,
  Download, Paperclip, Users, CheckCircle, CalendarDays,
} from "lucide-react"

interface MaterialFile { name: string; path: string; size?: number }

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="modal-title" className="font-serif text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
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
  const [modal, setModal] = useState<"details" | "enroll" | "announce" | "materials" | "cohorts" | "events" | null>(null)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [cohortForm, setCohortForm] = useState<{ name: string; start_date: string; end_date: string; enrollment_start: string; enrollment_end: string; max_students: string }>({ name: "", start_date: "", end_date: "", enrollment_start: "", enrollment_end: "", max_students: "" })
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null)
  const [savingCohort, setSavingCohort] = useState(false)
  const [courseEvents, setCourseEvents] = useState<CourseEvent[]>([])
  const [eventForm, setEventForm] = useState<{ title: string; description: string; event_type: string; event_date: string }>({ title: "", description: "", event_type: "other", event_date: "" })
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)

  const load = useCallback(async () => {
    if (!courseId) return
    try {
      const d = await coursesService.getCourse(courseId)
      setCourse(d); setTitle(d.title); setDescription(d.description ?? ""); setImageUrl(d.image_url ?? "")
      setEnrollStart(d.enrollment_start?.slice(0, 16) ?? ""); setEnrollEnd(d.enrollment_end?.slice(0, 16) ?? "")
      setMats(await storageService.listCourseMaterials(courseId).catch(() => []))
      setAnns(await coursesService.getAnnouncements(courseId).catch(() => []))
      setCohorts(await coursesService.getCourseCohorts(courseId).catch(() => []))
      setCourseEvents(await coursesService.getCourseEvents(courseId).catch(() => []))
    } catch { navigate("/teacher") } finally { setLoading(false) }
  }, [courseId, navigate])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (modal === "details") saveDetails()
        else if (modal === "enroll") saveEnrollment()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [modal, title, description, imageUrl, enrollStart, enrollEnd])

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
      setCourse(p => p ? { ...p, enrollment_start: enrollStart ? new Date(enrollStart).toISOString() : null, enrollment_end: enrollEnd ? new Date(enrollEnd).toISOString() : null } : p)
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

  const resetCohortForm = () => {
    setCohortForm({ name: "", start_date: "", end_date: "", enrollment_start: "", enrollment_end: "", max_students: "" })
    setEditingCohortId(null)
  }

  const startEditCohort = (c: Cohort) => {
    setCohortForm({
      name: c.name,
      start_date: c.start_date.slice(0, 10),
      end_date: c.end_date.slice(0, 10),
      enrollment_start: c.enrollment_start?.slice(0, 16) ?? "",
      enrollment_end: c.enrollment_end?.slice(0, 16) ?? "",
      max_students: c.max_students?.toString() ?? "",
    })
    setEditingCohortId(c.id)
  }

  const saveCohort = async () => {
    if (!courseId || !cohortForm.name.trim() || !cohortForm.start_date || !cohortForm.end_date) return
    setSavingCohort(true)
    const payload = {
      name: cohortForm.name.trim(),
      start_date: cohortForm.start_date,
      end_date: cohortForm.end_date,
      enrollment_start: cohortForm.enrollment_start ? new Date(cohortForm.enrollment_start).toISOString() : null,
      enrollment_end: cohortForm.enrollment_end ? new Date(cohortForm.enrollment_end).toISOString() : null,
      max_students: cohortForm.max_students ? parseInt(cohortForm.max_students) : null,
    }
    try {
      if (editingCohortId) {
        const updated = await coursesService.updateCohort(editingCohortId, payload)
        setCohorts(p => p.map(c => c.id === editingCohortId ? updated : c))
        toast({ title: "Cohort updated", variant: "success" })
      } else {
        const created = await coursesService.createCohort(courseId, payload)
        setCohorts(p => [...p, created])
        toast({ title: "Cohort created", variant: "success" })
      }
      resetCohortForm()
    } catch { toast({ title: "Failed to save cohort", variant: "destructive" }) }
    finally { setSavingCohort(false) }
  }

  const deleteCohort = async (id: string) => {
    if (!confirm("Delete this cohort?")) return
    try {
      await coursesService.deleteCohort(id)
      setCohorts(p => p.filter(c => c.id !== id))
      toast({ title: "Cohort deleted", variant: "success" })
    } catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  const completeCohort = async (id: string) => {
    if (!confirm("Mark this cohort as completed? This cannot be undone.")) return
    try {
      await coursesService.completeCohort(id)
      setCohorts(p => p.map(c => c.id === id ? { ...c, status: "completed" as const } : c))
      toast({ title: "Cohort completed", variant: "success" })
    } catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  const resetEventForm = () => {
    setEventForm({ title: "", description: "", event_type: "other", event_date: "" })
    setEditingEventId(null)
  }

  const startEditEvent = (e: CourseEvent) => {
    setEventForm({
      title: e.title,
      description: e.description ?? "",
      event_type: e.event_type,
      event_date: e.event_date.slice(0, 16),
    })
    setEditingEventId(e.id)
  }

  const saveEvent = async () => {
    if (!courseId || !eventForm.title.trim() || !eventForm.event_date) return
    setSavingEvent(true)
    const payload = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      event_type: eventForm.event_type,
      event_date: new Date(eventForm.event_date).toISOString(),
    }
    try {
      if (editingEventId) {
        const updated = await coursesService.updateCourseEvent(courseId, editingEventId, payload)
        setCourseEvents(p => p.map(e => e.id === editingEventId ? updated : e))
        toast({ title: "Event updated", variant: "success" })
      } else {
        const created = await coursesService.createCourseEvent(courseId, payload)
        setCourseEvents(p => [...p, created])
        toast({ title: "Event created", variant: "success" })
      }
      resetEventForm()
    } catch { toast({ title: "Failed to save event", variant: "destructive" }) }
    finally { setSavingEvent(false) }
  }

  const deleteEvent = async (id: string) => {
    if (!courseId || !confirm("Delete this event?")) return
    try {
      await coursesService.deleteCourseEvent(courseId, id)
      setCourseEvents(p => p.filter(e => e.id !== id))
      toast({ title: "Event deleted", variant: "success" })
    } catch { toast({ title: "Failed", variant: "destructive" }) }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="h-8 w-32 bg-muted rounded animate-pulse mb-6" />
        <div className="rounded-lg border overflow-hidden mb-8">
          <div className="h-48 bg-muted animate-pulse" />
          <div className="p-6 space-y-3">
            <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
            <div className="flex gap-2 mt-4">
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }
  if (!course) return null
  const modules = [...(course.modules ?? [])].sort((a, b) => a.order_index - b.order_index)
  const pub = course.status === "published"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/teacher" className="hover:text-foreground transition-colors">My Courses</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{course?.title || "Course"}</span>
      </div>

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
            <Button variant="outline" size="sm" onClick={() => setModal("details")}><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Details</Button>
            <Button variant="outline" size="sm" onClick={() => setModal("enroll")}><Calendar className="h-3.5 w-3.5 mr-1.5" />Enrollment</Button>
            <Button variant="outline" size="sm" onClick={() => setModal("announce")}><Megaphone className="h-3.5 w-3.5 mr-1.5" />Announcements</Button>
            <Button variant="outline" size="sm" onClick={() => setModal("materials")}><Paperclip className="h-3.5 w-3.5 mr-1.5" />Materials</Button>
            <Button variant="outline" size="sm" onClick={() => { resetEventForm(); setModal("events") }}><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Events</Button>
            <Button variant="outline" size="sm" onClick={() => { resetCohortForm(); setModal("cohorts") }}><Users className="h-3.5 w-3.5 mr-1.5" />Cohorts</Button>
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
            <p className="text-xs text-muted-foreground mt-2">Recommended: 1200×630px, JPG or PNG, max 5MB</p>
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
                    <time className="text-[10px] text-muted-foreground/60 mt-1 block">{new Date(a.created_at).toLocaleString()}</time>
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

      {/* Cohorts Modal */}
      <Modal open={modal === "cohorts"} onClose={() => { setModal(null); resetCohortForm() }} title="Manage Cohorts">
        <div className="space-y-4">
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {editingCohortId ? "Edit Cohort" : "Create Cohort"}
            </p>
            <Input value={cohortForm.name} onChange={e => setCohortForm(p => ({ ...p, name: e.target.value }))} placeholder="Cohort name (e.g. Spring 2026)" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={cohortForm.start_date} onChange={e => setCohortForm(p => ({ ...p, start_date: e.target.value }))} className="text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">End Date</Label><Input type="date" value={cohortForm.end_date} onChange={e => setCohortForm(p => ({ ...p, end_date: e.target.value }))} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Enrollment Start</Label><Input type="datetime-local" value={cohortForm.enrollment_start} onChange={e => setCohortForm(p => ({ ...p, enrollment_start: e.target.value }))} className="text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">Enrollment End</Label><Input type="datetime-local" value={cohortForm.enrollment_end} onChange={e => setCohortForm(p => ({ ...p, enrollment_end: e.target.value }))} className="text-sm" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Max Students (optional)</Label><Input type="number" value={cohortForm.max_students} onChange={e => setCohortForm(p => ({ ...p, max_students: e.target.value }))} placeholder="Unlimited" className="text-sm" /></div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveCohort} disabled={savingCohort || !cohortForm.name.trim() || !cohortForm.start_date || !cohortForm.end_date}>
                <Save className="h-3.5 w-3.5 mr-1.5" />{savingCohort ? "Saving…" : editingCohortId ? "Update Cohort" : "Create Cohort"}
              </Button>
              {editingCohortId && (
                <Button size="sm" variant="ghost" onClick={resetCohortForm}>Cancel</Button>
              )}
            </div>
          </div>

          {cohorts.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">No cohorts yet.</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">{cohorts.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <CohortStatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.start_date).toLocaleDateString()} &mdash; {new Date(c.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.student_count} student{c.student_count !== 1 ? "s" : ""}
                      {c.max_students && ` / ${c.max_students} max`}
                    </p>
                    {c.enrollment_start && c.enrollment_end && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Enrollment: {new Date(c.enrollment_start).toLocaleDateString()} — {new Date(c.enrollment_end).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEditCohort(c)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {c.status === "active" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700" onClick={() => completeCohort(c.id)}>
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteCohort(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}</div>}
        </div>
      </Modal>

      {/* Events Modal */}
      <Modal open={modal === "events"} onClose={() => { setModal(null); resetEventForm() }} title="Course Events">
        <div className="space-y-4">
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {editingEventId ? "Edit Event" : "Create Event"}
            </p>
            <Input value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))} placeholder="Event title" />
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={eventForm.description}
              onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Description (optional)"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  value={eventForm.event_type}
                  onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))}
                  className="w-full text-sm border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="deadline">Deadline</option>
                  <option value="live_session">Live Session</option>
                  <option value="exam">Exam</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date & Time</Label>
                <Input type="datetime-local" value={eventForm.event_date} onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEvent} disabled={savingEvent || !eventForm.title.trim() || !eventForm.event_date}>
                <Save className="h-3.5 w-3.5 mr-1.5" />{savingEvent ? "Saving…" : editingEventId ? "Update Event" : "Create Event"}
              </Button>
              {editingEventId && (
                <Button size="sm" variant="ghost" onClick={resetEventForm}>Cancel</Button>
              )}
            </div>
          </div>

          {courseEvents.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">No events yet.</p>
            : <div className="space-y-2 max-h-72 overflow-y-auto">{courseEvents.map(e => (
                <div key={e.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <EventTypeBadge type={e.event_type} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.event_date).toLocaleString()}
                    </p>
                    {e.description && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{e.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEditEvent(e)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteEvent(e.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}</div>}
        </div>
      </Modal>
    </div>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    deadline: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    live_session: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    exam: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    other: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400",
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${styles[type] ?? styles.other}`}>
      {type.replace("_", " ")}
    </span>
  )
}

function CohortStatusBadge({ status }: { status: Cohort["status"] }) {
  const styles: Record<Cohort["status"], string> = {
    upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    completed: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400",
    archived: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}
