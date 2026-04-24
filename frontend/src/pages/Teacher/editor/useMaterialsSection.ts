import { useCallback, useEffect, useRef, useState } from "react"
import { storageService } from "@/services/storage"
import { toast } from "@/lib/toast"
import type { useConfirm } from "@/components/ui/alert-dialog"
import type { MaterialFile } from "./types"

type Confirm = ReturnType<typeof useConfirm>

interface MaterialsSection {
  materials: MaterialFile[]
  uploading: boolean
  inputRef: React.RefObject<HTMLInputElement>
  triggerUpload: () => void
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  download: (m: MaterialFile) => Promise<void>
  remove: (m: MaterialFile) => Promise<void>
}

/**
 * Owns the "Materials" modal state for a course: list, upload input ref,
 * and upload/download/delete handlers.
 */
export function useMaterialsSection(
  courseId: string | undefined,
  confirm: Confirm,
): MaterialsSection {
  const [materials, setMaterials] = useState<MaterialFile[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    storageService
      .listCourseMaterials(courseId)
      .then((m) => {
        if (!cancelled) setMaterials(m)
      })
      .catch(() => {
        if (!cancelled) setMaterials([])
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  const triggerUpload = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !courseId) return
      setUploading(true)
      try {
        await storageService.uploadCourseMaterial(courseId, file)
        setMaterials(await storageService.listCourseMaterials(courseId))
      } catch {
        toast({ title: "Upload failed", variant: "destructive" })
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [courseId],
  )

  const download = useCallback(async (m: MaterialFile) => {
    try {
      window.open(
        await storageService.getSignedMaterialUrl(m.path),
        "_blank",
        "noopener,noreferrer",
      )
    } catch {
      toast({ title: "Download failed", variant: "destructive" })
    }
  }, [])

  const remove = useCallback(
    async (m: MaterialFile) => {
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
    },
    [confirm],
  )

  return {
    materials,
    uploading,
    inputRef,
    triggerUpload,
    handleUpload,
    download,
    remove,
  }
}
