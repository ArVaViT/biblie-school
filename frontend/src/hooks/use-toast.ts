import { toast as sonnerToast } from "sonner"

type Variant = "default" | "destructive" | "success" | "warning" | "info"

interface ToastOptions {
  title?: string
  description?: string
  variant?: Variant
}

function toast({ title, description, variant = "default" }: ToastOptions) {
  const body = title ?? description ?? ""
  const opts = title && description ? { description } : undefined

  switch (variant) {
    case "destructive":
      return { id: String(sonnerToast.error(body, opts)) }
    case "success":
      return { id: String(sonnerToast.success(body, opts)) }
    case "warning":
      return { id: String(sonnerToast.warning(body, opts)) }
    case "info":
      return { id: String(sonnerToast.info(body, opts)) }
    default:
      return { id: String(sonnerToast(body, opts)) }
  }
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  }
}

export { useToast, toast }
