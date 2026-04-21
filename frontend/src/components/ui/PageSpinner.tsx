interface PageSpinnerProps {
  /** Variants:
   *  - `page`: route-level fallback, centered with generous vertical padding
   *  - `screen`: full-viewport loader used during app bootstrap
   *  - `section`: in-card/in-section loader, smaller spinner and padding
   *  - `inline`: bare spinner (no wrapper) for one-off layouts */
  variant?: "page" | "screen" | "section" | "inline"
  /** Optional helper label shown under the spinner (screen variant only). */
  label?: string
}

// One shared spinner used everywhere we'd previously hand-rolled
// `animate-spin rounded-full border-* border-primary border-t-transparent`.
// Consolidating means theme tweaks (color, size) only need to land in one file.
export default function PageSpinner({ variant = "page", label }: PageSpinnerProps) {
  if (variant === "screen") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          {label && <span className="text-sm text-muted-foreground">{label}</span>}
        </div>
      </div>
    )
  }

  if (variant === "section") {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (variant === "inline") {
    return (
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    )
  }

  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
