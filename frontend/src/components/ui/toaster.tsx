import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-3 shadow-lg transition-all animate-in slide-in-from-bottom-5 ${
            t.variant === "destructive"
              ? "bg-destructive text-destructive-foreground border-destructive"
              : t.variant === "success"
              ? "bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800"
              : "bg-background border-border"
          }`}
        >
          {t.title && <p className="text-sm font-semibold">{t.title}</p>}
          {t.description && <p className="text-sm opacity-80 mt-0.5">{t.description}</p>}
        </div>
      ))}
    </div>
  )
}
