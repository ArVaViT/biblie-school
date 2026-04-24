import { BookOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface Props {
  onCreate: () => void
}

export function EmptyCoursesCard({ onCreate }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No courses yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first course to start teaching
        </p>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Course
        </Button>
      </CardContent>
    </Card>
  )
}
