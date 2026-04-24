import { useCallback, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  useAnnouncementsSection,
  useCohortsSection,
  useCourseData,
  useEventsSection,
  useMaterialsSection,
} from "./editor"
import type { CourseEditorModal } from "./editor/types"

/**
 * Course editor: the one place teachers edit everything about a course.
 *
 * This component is deliberately thin. Every concern (course basics,
 * announcements, materials, cohorts, events) is owned by a dedicated hook
 * from `./editor/`; this file just wires those hooks up to their modal
 * components and manages which modal is currently open.
 */
export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [modal, setModal] = useState<CourseEditorModal>(null)
  const closeModal = useCallback(() => setModal(null), [])
  const goBack = useCallback(() => navigate("/teacher"), [navigate])

  const data = useCourseData(courseId, confirm, goBack)
  const announcements = useAnnouncementsSection(courseId, confirm)
  const materials = useMaterialsSection(courseId, confirm)
  const cohorts = useCohortsSection(courseId, confirm)
  const events = useEventsSection(courseId, confirm)

  if (data.loading) return <CourseEditorSkeleton />
  if (!data.course)
    return (
      <div className="container mx-auto px-4">
        <ErrorState
          title="Course not found"
          description="The course may have been deleted or you may not have access."
          action={
            <Button variant="outline" size="sm" onClick={goBack}>
              Back to courses
            </Button>
          }
        />
      </div>
    )

  const { course, published: pub } = data

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        backTo="/teacher"
        backLabel="My courses"
        cover={
          <InlineEditCover
            value={course.image_url}
            onUpload={data.uploadCover}
            onRemove={data.removeCover}
            alt={course.title}
          />
        }
        title={
          <InlineEdit
            size="h1"
            value={course.title}
            onSave={(v) => data.savePatch({ title: v })}
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
            onSave={(v) => data.savePatch({ description: v || null })}
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
            <Button variant="outline" size="sm" onClick={data.togglePublish}>
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
                    events.resetForm()
                    setModal("events")
                  }}
                >
                  <CalendarDays /> Events
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    cohorts.resetForm()
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
        modules={data.sortedModules}
        onDragEnd={data.reorderModules}
        onAdd={data.addModule}
        onRemove={data.removeModule}
      />

      <EnrollmentModal
        open={modal === "enroll"}
        onClose={closeModal}
        start={data.enrollStart}
        end={data.enrollEnd}
        onStartChange={data.setEnrollStart}
        onEndChange={data.setEnrollEnd}
        saving={data.savingEnrollment}
        onSave={async () => {
          if (await data.saveEnrollment()) closeModal()
        }}
      />

      <AnnouncementsModal
        open={modal === "announce"}
        onClose={() => {
          closeModal()
          announcements.resetForm()
        }}
        announcements={announcements.announcements}
        title={announcements.title}
        content={announcements.content}
        onTitleChange={announcements.setTitle}
        onContentChange={announcements.setContent}
        posting={announcements.posting}
        onPost={announcements.post}
        onDelete={announcements.remove}
      />

      <MaterialsModal
        open={modal === "materials"}
        onClose={closeModal}
        materials={materials.materials}
        uploading={materials.uploading}
        onUploadClick={materials.triggerUpload}
        onUploadChange={materials.handleUpload}
        onDownload={materials.download}
        onDelete={materials.remove}
        fileInputRef={materials.inputRef}
      />

      <CohortsModal
        open={modal === "cohorts"}
        onClose={() => {
          closeModal()
          cohorts.resetForm()
        }}
        cohorts={cohorts.cohorts}
        form={cohorts.form}
        onFormChange={cohorts.setForm}
        editingId={cohorts.editingId}
        saving={cohorts.saving}
        onSave={cohorts.save}
        onCancelEdit={cohorts.resetForm}
        onEdit={cohorts.startEdit}
        onDelete={cohorts.remove}
        onComplete={cohorts.complete}
      />

      <EventsModal
        open={modal === "events"}
        onClose={() => {
          closeModal()
          events.resetForm()
        }}
        events={events.events}
        form={events.form}
        onFormChange={events.setForm}
        editingId={events.editingId}
        saving={events.saving}
        onSave={events.save}
        onCancelEdit={events.resetForm}
        onEdit={events.startEdit}
        onDelete={events.remove}
      />
    </div>
  )
}
