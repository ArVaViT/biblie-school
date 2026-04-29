import { Modal } from "@/components/patterns"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { CourseMaterial } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  materials: CourseMaterial[]
  downloadingPath: string | null
  onDownload: (path: string) => void
}

export function MaterialsModal({
  open,
  onClose,
  materials,
  downloadingPath,
  onDownload,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Course Materials">
      {materials.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No materials available.
        </p>
      ) : (
        <div className="divide-y rounded-md border text-sm">
          {materials.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <span className="truncate mr-2">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 text-xs"
                disabled={downloadingPath === file.path}
                onClick={() => onDownload(file.path)}
              >
                {downloadingPath === file.path ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
