import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { useAuth } from "@/context/AuthContext"
import { toast } from "@/hooks/use-toast"
import type { Certificate } from "@/types"
import { Award, Copy, CheckCircle, Sparkles, Clock, XCircle, RefreshCw, Star } from "lucide-react"

interface Props {
  courseId: string
  progress: number
  certificate: Certificate | null
  onCertificateUpdate: (cert: Certificate | null) => void
  onReviewSubmitted?: () => void
}

export default function CertificateCard({ courseId, progress, certificate, onCertificateUpdate, onReviewSubmitted }: Props) {
  const { user } = useAuth()
  const [requesting, setRequesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)

  const handleReviewSubmit = async () => {
    if (reviewRating === 0) {
      toast({ title: "Please select a rating", variant: "destructive" })
      return
    }
    setReviewSubmitting(true)
    try {
      await coursesService.submitReview(courseId, {
        rating: reviewRating,
        comment: reviewComment || undefined,
      })
      toast({ title: "Review submitted!", variant: "success" })
      setReviewDone(true)
      onReviewSubmitted?.()
    } catch {
      toast({ title: "Failed to submit review", variant: "destructive" })
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleRequest = async () => {
    setRequesting(true)
    try {
      const cert = await coursesService.requestCertificate(courseId)
      onCertificateUpdate(cert)
      toast({ title: "Certificate requested!", variant: "success" })
    } catch {
      toast({ title: "Failed to request certificate", variant: "destructive" })
    } finally {
      setRequesting(false)
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

  if (progress < 100) return null

  if (!certificate) {
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
                Request your certificate of completion for review.
              </p>
            </div>
            <Button
              onClick={handleRequest}
              disabled={requesting}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-md"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              {requesting ? "Requesting..." : "Request Certificate"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (certificate.status === "pending") {
    return (
      <Card className="border-amber-300/50 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10 dark:border-amber-700/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-7 w-7 text-amber-500 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                Awaiting teacher approval
              </h3>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                Your certificate request has been submitted. Your instructor will review it shortly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (certificate.status === "teacher_approved") {
    return (
      <Card className="border-blue-300/50 bg-gradient-to-br from-blue-50/50 to-sky-50/30 dark:from-blue-950/20 dark:to-sky-950/10 dark:border-blue-700/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-7 w-7 text-blue-500 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                Awaiting admin approval
              </h3>
              <p className="text-sm text-blue-700/80 dark:text-blue-400/70 mt-0.5">
                Your teacher has approved your certificate. It is now pending final admin approval.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (certificate.status === "approved") {
    return (
      <Card className="border-2 border-amber-400/60 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-orange-50/30 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/10 dark:border-amber-600/40 shadow-lg shadow-amber-100/50 dark:shadow-amber-900/20">
        <CardContent className="py-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 shadow-md">
              <Award className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-200">
                    Certificate Approved!
                  </h3>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm text-amber-700/80 dark:text-amber-400/70">
                  Congratulations! Your certificate has been approved.
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
                    {certificate.issued_at
                      ? new Date(certificate.issued_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Pending"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {user && !reviewDone && (
            <div className="border-t border-amber-300/40 dark:border-amber-700/30 pt-5 space-y-3">
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                How was this course? Leave a review
              </h4>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    onMouseEnter={() => setReviewHover(value)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        value <= (reviewHover || reviewRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-amber-300/40 dark:text-amber-700/40"
                      }`}
                    />
                  </button>
                ))}
                {reviewRating > 0 && (
                  <span className="text-sm text-amber-700/70 dark:text-amber-400/60 ml-2">
                    {reviewRating}/5
                  </span>
                )}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your thoughts about this course... (optional)"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-amber-200/60 dark:border-amber-700/40 bg-white/60 dark:bg-black/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
              />
              <Button
                onClick={handleReviewSubmit}
                disabled={reviewSubmitting}
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
              >
                {reviewSubmitting ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          )}

          {reviewDone && (
            <div className="border-t border-amber-300/40 dark:border-amber-700/30 pt-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <CheckCircle className="h-4 w-4" />
              Thank you for your review!
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (certificate.status === "rejected") {
    return (
      <Card className="border-red-300/50 bg-gradient-to-br from-red-50/50 to-rose-50/30 dark:from-red-950/20 dark:to-rose-950/10 dark:border-red-700/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <XCircle className="h-7 w-7 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                Certificate request was not approved
              </h3>
              <p className="text-sm text-red-700/80 dark:text-red-400/70 mt-0.5">
                Unfortunately, your certificate request was rejected. You may re-request after addressing any outstanding requirements.
              </p>
            </div>
            <Button
              onClick={handleRequest}
              disabled={requesting}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {requesting ? "Requesting..." : "Re-request"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
