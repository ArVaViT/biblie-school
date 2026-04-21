import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import type { Certificate, Enrollment } from "@/types"
import { toast } from "@/hooks/use-toast"
import { Award, ArrowLeft, ScrollText } from "lucide-react"
import PageSpinner from "@/components/ui/PageSpinner"

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [certs, courses] = await Promise.all([
          coursesService.getMyCertificates(),
          coursesService.getMyCourses().catch(() => []),
        ])
        if (cancelled) return
        setCertificates(certs)
        setEnrollments(courses)
      } catch {
        if (!cancelled) toast({ title: "Failed to load certificates", variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const courseTitle = (courseId: string) => {
    const enrollment = enrollments.find((e) => e.course_id === courseId)
    return enrollment?.course?.title ?? `Course ${courseId.slice(0, 8)}…`
  }

  if (loading) {
    return <PageSpinner />
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Dashboard
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          My Certificates
        </h1>
        <p className="text-muted-foreground mt-2">
          Certificates you've earned for completing courses
        </p>
      </div>

      {certificates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
              <ScrollText className="h-8 w-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-medium mb-1">No certificates yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Complete a course to earn your first certificate. Keep learning and collecting achievements!
            </p>
            <Link to="/">
              <Button size="sm">Browse Courses</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {certificates.map((cert) => (
            <Card
              key={cert.id}
              className="group relative overflow-hidden border-amber-200/60 dark:border-amber-800/40 hover:shadow-lg hover:shadow-amber-100/50 dark:hover:shadow-amber-900/20 transition-all duration-300"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />

              <CardContent className="pt-6 pb-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-900/40 dark:to-yellow-900/20 flex items-center justify-center shadow-sm">
                    <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/70 tracking-wider uppercase">
                    Certificate
                  </span>
                </div>

                <h3 className="font-semibold text-sm leading-snug mb-3 line-clamp-2 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                  {courseTitle(cert.course_id)}
                </h3>

                <dl className="space-y-2 text-xs">
                  {cert.certificate_number && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Certificate No.</dt>
                      <dd className="font-mono font-medium text-amber-700 dark:text-amber-400">
                        {cert.certificate_number}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">
                      {cert.status === "approved" ? "Issued" : "Status"}
                    </dt>
                    <dd className="font-medium">
                      {cert.status === "approved" && cert.issued_at
                        ? new Date(cert.issued_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : cert.status === "pending"
                          ? "Pending approval"
                          : cert.status === "teacher_approved"
                            ? "Awaiting admin"
                            : cert.status === "rejected"
                              ? "Rejected"
                              : "Pending"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
