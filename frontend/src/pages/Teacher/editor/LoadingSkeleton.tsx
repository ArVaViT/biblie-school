/** Centered skeleton shown while the course editor loads. */
export function CourseEditorSkeleton() {
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
