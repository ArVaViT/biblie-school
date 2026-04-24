import { useCallback, useEffect, useState } from "react"
import { coursesService } from "@/services/courses"
import { toast } from "@/lib/toast"
import type { Cohort } from "@/types"
import type { useConfirm } from "@/components/ui/alert-dialog"
import { EMPTY_COHORT_FORM, type CohortFormState } from "./types"

type Confirm = ReturnType<typeof useConfirm>

interface CohortsSection {
  cohorts: Cohort[]
  form: CohortFormState
  setForm: (v: CohortFormState) => void
  editingId: string | null
  saving: boolean
  startEdit: (c: Cohort) => void
  save: () => Promise<void>
  remove: (id: string) => Promise<void>
  complete: (id: string) => Promise<void>
  resetForm: () => void
}

/**
 * Owns the "Cohorts" modal state: list, the inline edit form, and
 * create/update/delete/complete handlers.
 */
export function useCohortsSection(
  courseId: string | undefined,
  confirm: Confirm,
): CohortsSection {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [form, setForm] = useState<CohortFormState>(EMPTY_COHORT_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    coursesService
      .getCourseCohorts(courseId)
      .then((c) => {
        if (!cancelled) setCohorts(c)
      })
      .catch(() => {
        if (!cancelled) setCohorts([])
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  const resetForm = useCallback(() => {
    setForm(EMPTY_COHORT_FORM)
    setEditingId(null)
  }, [])

  const startEdit = useCallback((c: Cohort) => {
    setForm({
      name: c.name,
      start_date: c.start_date.slice(0, 10),
      end_date: c.end_date.slice(0, 10),
      enrollment_start: c.enrollment_start?.slice(0, 16) ?? "",
      enrollment_end: c.enrollment_end?.slice(0, 16) ?? "",
      max_students: c.max_students?.toString() ?? "",
    })
    setEditingId(c.id)
  }, [])

  const save = useCallback(async () => {
    if (!courseId || !form.name.trim() || !form.start_date || !form.end_date) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      enrollment_start: form.enrollment_start
        ? new Date(form.enrollment_start).toISOString()
        : null,
      enrollment_end: form.enrollment_end
        ? new Date(form.enrollment_end).toISOString()
        : null,
      max_students: form.max_students ? parseInt(form.max_students) : null,
    }
    try {
      if (editingId) {
        const updated = await coursesService.updateCohort(editingId, payload)
        setCohorts((p) => p.map((c) => (c.id === editingId ? updated : c)))
        toast({ title: "Cohort updated", variant: "success" })
      } else {
        const created = await coursesService.createCohort(courseId, payload)
        setCohorts((p) => [...p, created])
        toast({ title: "Cohort created", variant: "success" })
      }
      resetForm()
    } catch {
      toast({ title: "Failed to save cohort", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [courseId, form, editingId, resetForm])

  const remove = useCallback(
    async (id: string) => {
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
    },
    [confirm],
  )

  const complete = useCallback(
    async (id: string) => {
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
    },
    [confirm],
  )

  return {
    cohorts,
    form,
    setForm,
    editingId,
    saving,
    startEdit,
    save,
    remove,
    complete,
    resetForm,
  }
}
