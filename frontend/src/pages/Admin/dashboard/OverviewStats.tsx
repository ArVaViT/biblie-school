import { Card, CardContent } from "@/components/ui/card"
import { Users, BookOpen, GraduationCap } from "lucide-react"
import type { AdminStats } from "./constants"

interface Props {
  stats: AdminStats
  loading: boolean
}

const CARDS = [
  { key: "users", label: "Total Users", icon: Users },
  { key: "courses", label: "Total Courses", icon: BookOpen },
  { key: "enrollments", label: "Total Enrollments", icon: GraduationCap },
] as const

/** Three-card stats row on the admin overview tab. */
export function OverviewStats({ stats, loading }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {CARDS.map(({ key, label, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-md bg-muted p-3">
              <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">
                {loading ? "—" : stats[key].toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
