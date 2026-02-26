import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { Module } from "@/types"
import { ArrowLeft, Book } from "lucide-react"

export default function ModuleView() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const [module, setModule] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!courseId || !moduleId) return
      try {
        setModule(await coursesService.getModule(courseId, moduleId))
      } catch (error) {
        console.error("Failed to load module:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId, moduleId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!module) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Book className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium">Module not found</h2>
      </div>
    )
  }

  const sortedChapters = [...(module.chapters ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link to={`/courses/${courseId}`}>
        <Button variant="ghost" size="sm" className="mb-6 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Course
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{module.title}</h1>
        {module.description && (
          <p className="text-muted-foreground leading-relaxed">{module.description}</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Book className="h-5 w-5" />
          Chapters
          <span className="text-sm font-normal text-muted-foreground">
            ({sortedChapters.length})
          </span>
        </h2>

        {sortedChapters.length > 0 ? (
          <div className="space-y-4">
            {sortedChapters.map((chapter, idx) => (
              <Card key={chapter.id} className="animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    {chapter.title}
                  </CardTitle>
                </CardHeader>
                {chapter.content && (
                  <CardContent className="pt-0 ml-8">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: chapter.content }}
                    />
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No chapters added yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
