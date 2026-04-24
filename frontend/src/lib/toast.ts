import { toast as sonnerToast } from "sonner"

type Variant = "default" | "destructive" | "success" | "warning" | "info"

interface ToastOptions {
  title?: string
  description?: string
  variant?: Variant
}

const SONNER_BY_VARIANT: Record<Variant, (message: string, opts?: { description?: string }) => string | number> = {
  default: sonnerToast,
  destructive: sonnerToast.error,
  success: sonnerToast.success,
  warning: sonnerToast.warning,
  info: sonnerToast.info,
}

export function toast({ title, description, variant = "default" }: ToastOptions) {
  const body = title ?? description ?? ""
  const opts = title && description ? { description } : undefined
  SONNER_BY_VARIANT[variant](body, opts)
}
