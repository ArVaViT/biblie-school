/** Animated placeholder shown while student progress loads. */
export function StudentProgressSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
      <div className="rounded-lg border">
        <div className="p-4 border-b">
          <div className="h-9 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
