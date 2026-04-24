export function CourseDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="h-8 w-24 animate-pulse bg-muted rounded mb-4" />
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-36 h-24 animate-pulse bg-muted rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-3/4 animate-pulse bg-muted rounded" />
          <div className="h-4 w-1/2 animate-pulse bg-muted rounded" />
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}
