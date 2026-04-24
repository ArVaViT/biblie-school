import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { coursesService } from "@/services/courses"
import { storageService } from "@/services/storage"
import type {
  Announcement,
  Cohort,
  Course,
  CourseEvent,
} from "@/types"
import { toast } from "@/lib/toast"
import { useConfirm } from "@/components/ui/alert-dialog"
import {
  Calendar,
  CalendarDays,
  Eye,
  EyeOff,
  Megaphone,
  MoreHorizontal,
  Paperclip,
  Users,
} from "lucide-react"
import {
  ErrorState,
  InlineEdit,
  InlineEditCover,
  PageHeader,
} from "@/components/patterns"
import {
  AnnouncementsModal,
  CohortsModal,
  CourseEditorSkeleton,
  EnrollmentModal,
  EventsModal,
  MaterialsModal,
  ModulesList,
} from "./editor"
import {
  EMPTY_COHORT_FORM,
  EMPTY_EVENT_FORM,
  type CohortFormState,
  type CourseEditorModal,
  type EventFormState,
  type MaterialFile,
} from "./editor/types"

/**
 * Course editor: the one place teachers edit everything about a course.
 *
 * This file is intentionally a thin orchestrator. It owns every piece of
 * mutable state (course, announcements, materials, cohorts, events, which
 * modal is open) and dispatches mutations through the service layer; the
 * rendering of each concern lives in `editor/*` so the main file stays a
 * readable list of handlers + a JSX skeleton.
 */
export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<CourseEditorModal>(null)

  const [enrollStart, setEnrollStart] = useState("")
  const [enrollEnd, setEnrollEnd] = useState("")
  const [savingEnrollment, setSavingEnrollment] = useState(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [annTitle, setAnnTitle] = useState("")
  const [annContent, setAnnContent] = useState("")
  const [postingAnn, setPostingAnn] = useState(false)

  const [materials, setMaterials] = useState<MaterialFile[]>([])
  const [uploadingMat, setUploadingMat] = useState(false)
  const materialInputRef = useRef<HTMLInputElement>(null)

  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [cohortForm, setCohortForm] = useState<CohortFormState>(EMPTY_COHORT_FORM)
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null)
  const [savingCohort, setSavingCohort] = useState(false)

  const [courseEvents, setCourseEvents] = useState<CourseEvent[]>([])
  const [eventForm, setEventForm] = useState<EventFormState>(EMPTY_EVENT_FORM)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)

  const [reorderingModules, setReorderingModules] = useState(false)

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!courseId) return
      setLoading(true)
      try {
        const [courseData, mats, anns, chs, events] = await Promise.all([
          coursesService.getCourse(courseId),
          storageService.listCourseMaterials(courseId).catch(() => []),
          coursesService.getAnnouncements(courseId).catch(() => []),
          coursesService.getCourseCohorts(courseId).catch(() => []),
          coursesService.getCourseEvents(courseId).catch(() => []),
        ])
        if (signal?.cancelled) return
        setCourse(courseData)
        setEnrollStart(courseData.enrollment_start?.slice(0, 16) ?? "")
        setEnrollEnd(courseData.enrollment_end?.slice(0, 16) ?? "")
        setMaterials(mats)
        setAnnouncements(anns)
        setCohorts(chs)
        setCourseEvents(events)
      } catch {
        if (!signal?.cancelled) navigate("/teacher")
      } finally {
        if (!signal?.cancelled) setLoading(false)
      }
    },
    [courseId, navigate],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load])

  const savePatch = useCallback(
    async (patch: Parameters<typeof coursesService.updateCourse>[1]) => {
      if (!courseId) return
      try {
        const updated = await coursesService.updateCourse(courseId, patch)
        setCourse((p) => (p ? { ...p, ...updated } : p))
        toast({ title: "Saved", variant: "success" })
      } catch {
        toast({ title: "Failed to save", variant: "destructive" })
        throw new Error("save failed")
      }
    },
    [courseId],
  )

  const uploadCover = useCallback(
    async (file: File) => {
      if (!courseId) throw new Error("no course")
      const url = await storageService.uploadCourseImage(courseId, file)
      await coursesService.updateCourse(courseId, { image_url: url })
      setCourse((p) => (p ? { ...p, image_url: url } : p))
      toast({ title: "Cover updated", variant: "success" })
      return url
    },
    [courseId],
  )

  const removeCover = useCallback(async () => {
    if (!courseId) return
    try {
      await coursesService.updateCourse(courseId, { image_url: null })
      setCourse((p) => (p ? { ...p, image_url: null } : p))
      toast({ title: "Cover removed", variant: "success" })
    } catch {
      toast({ title: "Failed to remove cover", variant: "destructive" })
    }
  }, [courseId])

  const saveEnrollment = useCallback(async () => {
    if (!courseId) return
    setSavingEnrollment(true)
    try {
      const payload = {
        enrollment_start: enrollStart ? new Date(enrollStart).toISOString() : null,
        enrollment_end: enrollEnd ? new Date(enrollEnd).toISOString() : null,
      }
      await coursesService.updateCourse(courseId, payload)
      setCourse((p) => (p ? { ...p, ...payload } : p))
      toast({ title: "Enrollment saved", variant: "success" })
      setModal(null)
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSavingEnrollment(false)
    }
  }, [courseId, enrollStart, enrollEnd])

  const togglePublish = async () => {
    if (!courseId || !course) return
    const next = course.status === "published" ? ("draft" as const) : ("published" as const)
    try {
      await coursesService.updateCourse(courseId, { status: next })
      setCourse((p) => (p ? { ...p, status: next } : p))
      toast({
        title: next === "published" ? "Published" : "Unpublished",
        variant: "success",
      })
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const addModule = async () => {
    if (!courseId) return
    const order = course?.modules?.length ?? 0
    try {
      const m = await coursesService.createModule(courseId, {
        title: `Module ${order + 1}`,
        order_index: order,
      })
      setCourse((p) => (p ? { ...p, modules: [...(p.modules ?? []), { ...m, chapters: [] }] } : p))
      toast({ title: "Module added", variant: "success" })
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const removeModule = async (id: string) => {
    if (!courseId) return
    const ok = await confirm({
      title: "Delete this module?",
      description: "All chapters inside the module will also be removed.",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteModule(courseId, id)
      setCourse((p) => (p ? { ...p, modules: p.modules?.filter((m) => m.id !== id) } : p))
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const postAnnouncement = async () => {
    if (!courseId || !annTitle.trim()) return
    setPostingAnn(true)
    try {
      const a = await coursesService.createAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim(),
        course_id: courseId,
      })
      setAnnouncements((p) => [a, ...p])
      setAnnTitle("")
      setAnnContent("")
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    } finally {
      setPostingAnn(false)
    }
  }

  const deleteAnn = async (id: string) => {
    const ok = await confirm({
      title: "Delete this announcement?",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteAnnouncement(id)
      setAnnouncements((p) => p.filter((a) => a.id !== id))
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const handleMatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !courseId) return
    setUploadingMat(true)
    try {
      await storageService.uploadCourseMaterial(courseId, file)
      setMaterials(await storageService.listCourseMaterials(courseId))
    } catch {
      toast({ title: "Upload failed", variant: "destructive" })
    } finally {
      setUploadingMat(false)
      if (materialInputRef.current) materialInputRef.current.value = ""
    }
  }

  const downloadMaterial = async (m: MaterialFile) => {
    try {
      window.open(
        await storageService.getSignedMaterialUrl(m.path),
        "_blank",
        "noopener,noreferrer",
      )
    } catch {
      toast({ title: "Download failed", variant: "destructive" })
    }
  }

  const deleteMaterial = async (m: MaterialFile) => {
    const ok = await confirm({
      title: "Delete material?",
      description: `"${m.name}" will be permanently removed.`,
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await storageService.deleteCourseMaterial(m.path)
      setMaterials((p) => p.filter((x) => x.path !== m.path))
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const resetCohortForm = () => {
    setCohortForm(EMPTY_COHORT_FORM)
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
    if (!courseId || !cohortForm.name.trim() || !cohortForm.start_date || !cohortForm.end_date)
      return
    setSavingCohort(true)
    const payload = {
      name: cohortForm.name.trim(),
      start_date: cohortForm.start_date,
      end_date: cohortForm.end_date,
      enrollment_start: cohortForm.enrollment_start
        ? new Date(cohortForm.enrollment_start).toISOString()
        : null,
      enrollment_end: cohortForm.enrollment_end
        ? new Date(cohortForm.enrollment_end).toISOString()
        : null,
      max_students: cohortForm.max_students ? parseInt(cohortForm.max_students) : null,
    }
    try {
      if (editingCohortId) {
        const updated = await coursesService.updateCohort(editingCohortId, payload)
        setCohorts((p) => p.map((c) => (c.id === editingCohortId ? updated : c)))
        toast({ title: "Cohort updated", variant: "success" })
      } else {
        const created = await coursesService.createCohort(courseId, payload)
        setCohorts((p) => [...p, created])
        toast({ title: "Cohort created", variant: "success" })
      }
      resetCohortForm()
    } catch {
      toast({ title: "Failed to save cohort", variant: "destructive" })
    } finally {
      setSavingCohort(false)
    }
  }

  const deleteCohort = async (id: string) => {
    const ok = await confirm({
      title: "Delete this cohort?",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteCohort(id)
      setCohorts((p) => p.filter((c) => c.id !== id))
      toast({ title: "Cohort deleted", variant: "success" })
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const completeCohort = async (id: string) => {
    const ok = await confirm({
      title: "Mark cohort as completed?",
      description: "This cannot be undone.",
      confirmLabel: "Complete cohort",
    })
    if (!ok) return
    try {
      await coursesService.completeCohort(id)
      setCohorts((p) =>
        p.map((c) => (c.id === id ? { ...c, status: "completed" as const } : c)),
      )
      toast({ title: "Cohort completed", variant: "success" })
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const resetEventForm = () => {
    setEventForm(EMPTY_EVENT_FORM)
    setEditingEventId(null)
  }

  const startEditEvent = (ev: CourseEvent) => {
    setEventForm({
      title: ev.title,
      description: ev.description ?? "",
      event_type: ev.event_type,
      event_date: ev.event_date.slice(0, 16),
    })
    setEditingEventId(ev.id)
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
        const updated = await coursesService.updateCourseEvent(
          courseId,
          editingEventId,
          payload,
        )
        setCourseEvents((p) => p.map((ev) => (ev.id === editingEventId ? updated : ev)))
        toast({ title: "Event updated", variant: "success" })
      } else {
        const created = await coursesService.createCourseEvent(courseId, payload)
        setCourseEvents((p) => [...p, created])
        toast({ title: "Event created", variant: "success" })
      }
      resetEventForm()
    } catch {
      toast({ title: "Failed to save event", variant: "destructive" })
    } finally {
      setSavingEvent(false)
    }
  }

  const deleteEvent = async (id: string) => {
    if (!courseId) return
    const ok = await confirm({
      title: "Delete this event?",
      confirmLabel: "Delete",
      tone: "destructive",
    })
    if (!ok) return
    try {
      await coursesService.deleteCourseEvent(courseId, id)
      setCourseEvents((p) => p.filter((e) => e.id !== id))
      toast({ title: "Event deleted", variant: "success" })
    } catch {
      toast({ title: "Failed", variant: "destructive" })
    }
  }

  const sortedModules = [...(course?.modules ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )

  const handleModuleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination || !courseId || reorderingModules) return
      const from = result.source.index
      const to = result.destination.index
      if (from === to) return

      const reordered = Array.from(sortedModules)
      const [moved] = reordered.splice(from, 1)
      if (!moved) return
      reordered.splice(to, 0, moved)

      setCourse((prev) =>
        prev
          ? { ...prev, modules: reordered.map((m, i) => ({ ...m, order_index: i })) }
          : prev,
      )

      setReorderingModules(true)
      try {
        await Promise.all(
          reordered
            .map((m, i) =>
              m.order_index !== i
                ? coursesService.updateModule(courseId, m.id, { order_index: i })
                : null,
            )
            .filter(Boolean),
        )
      } catch {
        toast({ title: "Failed to save module order", variant: "destructive" })
        void load()
      } finally {
        setReorderingModules(false)
      }
    },
    [sortedModules, courseId, load, reorderingModules],
  )

  if (loading) return <CourseEditorSkeleton />
  if (!course)
    return (
      <div className="container mx-auto px-4">
        <ErrorState
          title="Course not found"
          description="The course may have been deleted or you may not have access."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/teacher")}>
              Back to courses
            </Button>
          }
        />
      </div>
    )

  const pub = course.status === "published"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        backTo="/teacher"
        backLabel="My courses"
        cover={
          <InlineEditCover
            value={course.image_url}
            onUpload={uploadCover}
            onRemove={removeCover}
            alt={course.title}
          />
        }
        title={
          <InlineEdit
            size="h1"
            value={course.title}
            onSave={(v) => savePatch({ title: v })}
            required
            placeholder="Untitled course"
            ariaLabel="Edit course title"
            maxLength={200}
          />
        }
        description={
          <InlineEdit
            size="body"
            multiline
            value={course.description ?? ""}
            onSave={(v) => savePatch({ description: v || null })}
            placeholder="Add a course description"
            ariaLabel="Edit course description"
            maxLength={2000}
          />
        }
        meta={
          <Badge variant={pub ? "success" : "warning"} className="uppercase tracking-wide">
            {pub ? "Published" : "Draft"}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={togglePublish}>
              {pub ? (
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Eye className="h-3.5 w-3.5 mr-1.5" />
              )}
              {pub ? "Unpublish" : "Publish"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setModal("enroll")}>
                  <Calendar /> Enrollment
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setModal("announce")}>
                  <Megaphone /> Announcements
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setModal("materials")}>
                  <Paperclip /> Materials
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    resetEventForm()
                    setModal("events")
                  }}
                >
                  <CalendarDays /> Events
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    resetCohortForm()
                    setModal("cohorts")
                  }}
                >
                  <Users /> Cohorts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <ModulesList
        courseId={courseId ?? ""}
        modules={sortedModules}
        onDragEnd={handleModuleDragEnd}
        onAdd={addModule}
        onRemove={removeModule}
      />

      <EnrollmentModal
        open={modal === "enroll"}
        onClose={() => setModal(null)}
        start={enrollStart}
        end={enrollEnd}
        onStartChange={setEnrollStart}
        onEndChange={setEnrollEnd}
        saving={savingEnrollment}
        onSave={saveEnrollment}
      />

      <AnnouncementsModal
        open={modal === "announce"}
        onClose={() => {
          setModal(null)
          setAnnTitle("")
          setAnnContent("")
        }}
        announcements={announcements}
        title={annTitle}
        content={annContent}
        onTitleChange={setAnnTitle}
        onContentChange={setAnnContent}
        posting={postingAnn}
        onPost={postAnnouncement}
        onDelete={deleteAnn}
      />

      <MaterialsModal
        open={modal === "materials"}
        onClose={() => setModal(null)}
        materials={materials}
        uploading={uploadingMat}
        onUploadClick={() => materialInputRef.current?.click()}
        onUploadChange={handleMatUpload}
        onDownload={downloadMaterial}
        onDelete={deleteMaterial}
        fileInputRef={materialInputRef}
      />

      <CohortsModal
        open={modal === "cohorts"}
        onClose={() => {
          setModal(null)
          resetCohortForm()
        }}
        cohorts={cohorts}
        form={cohortForm}
        onFormChange={setCohortForm}
        editingId={editingCohortId}
        saving={savingCohort}
        onSave={saveCohort}
        onCancelEdit={resetCohortForm}
        onEdit={startEditCohort}
        onDelete={deleteCohort}
        onComplete={completeCohort}
      />

      <EventsModal
        open={modal === "events"}
        onClose={() => {
          setModal(null)
          resetEventForm()
        }}
        events={courseEvents}
        form={eventForm}
        onFormChange={setEventForm}
        editingId={editingEventId}
        saving={savingEvent}
        onSave={saveEvent}
        onCancelEdit={resetEventForm}
        onEdit={startEditEvent}
        onDelete={deleteEvent}
      />
    </div>
  )
}
