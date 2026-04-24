import { Card, CardContent } from "@/components/ui/card"
import { Award, TrendingUp, Users } from "lucide-react"

interface Props {
  totalStudents: number
  averageProgress: number
  completionRate: number
}

const CARDS = [
  { key: "total", label: "Total Students", icon: Users },
  { key: "avg", label: "Average Progress", icon: TrendingUp },
  { key: "completion", label: "Completion Rate", icon: Award },
] as const

export function ProgressStats({ totalStudents, averageProgress, completionRate }: Props) {
  const values: Record<(typeof CARDS)[number]["key"], string> = {
    total: totalStudents.toString(),
    avg: `${averageProgress}%`,
    completion: `${completionRate}%`,
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {CARDS.map(({ key, label, icon: Icon }) => (
        <Card key={key}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-1">{values[key]}</p>
              </div>
              <Icon className="h-8 w-8 text-muted-foreground/60" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
