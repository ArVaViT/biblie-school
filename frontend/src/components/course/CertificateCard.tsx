import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { toast } from "@/hooks/use-toast"
import type { Certificate } from "@/types"
import { Award, Copy, CheckCircle, Sparkles } from "lucide-react"

interface Props {
  courseId: string
}

export default function CertificateCard({ courseId }: Props) {
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const cert = await coursesService.getCourseCertificate(courseId)
        setCertificate(cert)
      } catch {
        // no certificate yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId])

  const handleClaim = async () => {
    setClaiming(true)
    try {
      const cert = await coursesService.issueCertificate(courseId)
      setCertificate(cert)
      toast({ title: "Certificate claimed!", variant: "success" })
    } catch (err) {
      console.error("Failed to claim certificate:", err)
      toast({ title: "Failed to claim certificate", variant: "destructive" })
    } finally {
      setClaiming(false)
    }
  }

  const handleCopy = async () => {
    if (!certificate) return
    try {
      await navigator.clipboard.writeText(certificate.certificate_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <Card className="border-amber-300/50 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10 dark:border-amber-700/30">
        <CardContent className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  if (certificate) {
    return (
      <Card className="border-2 border-amber-400/60 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-orange-50/30 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/10 dark:border-amber-600/40 shadow-lg shadow-amber-100/50 dark:shadow-amber-900/20">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 shadow-md">
              <Award className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-200">
                    Course Completed!
                  </h3>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm text-amber-700/80 dark:text-amber-400/70">
                  Congratulations! You have earned a certificate for completing this course.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-amber-600/70 dark:text-amber-500/60 mb-0.5">
                    Certificate Number
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm bg-white/60 dark:bg-black/20 px-2.5 py-1 rounded border border-amber-200/60 dark:border-amber-700/40 text-amber-900 dark:text-amber-200 select-all">
                      {certificate.certificate_number}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-amber-600/70 dark:text-amber-500/60 mb-0.5">
                    Issue Date
                  </p>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    {new Date(certificate.issued_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-dashed border-amber-300/50 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10 dark:border-amber-700/30">
      <CardContent className="py-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Award className="h-7 w-7 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              You completed this course!
            </h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-400/70 mt-0.5">
              Claim your certificate of completion.
            </p>
          </div>
          <Button
            onClick={handleClaim}
            disabled={claiming}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-md"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {claiming ? "Claiming..." : "Claim Certificate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
