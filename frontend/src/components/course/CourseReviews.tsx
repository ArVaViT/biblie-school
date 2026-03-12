import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { coursesService } from "@/services/courses"
import { useAuth } from "@/context/AuthContext"
import { toast } from "@/hooks/use-toast"
import type { CourseReview, Certificate } from "@/types"
import { Star, Pencil, Trash2, MessageSquare, Lock } from "lucide-react"

interface Props {
  courseId: string
  isEnrolled: boolean
  certificate?: Certificate | null
}

export default function CourseReviews({ courseId, isEnrolled, certificate }: Props) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadReviews()
  }, [courseId])

  const loadReviews = async () => {
    try {
      const data = await coursesService.getCourseReviews(courseId)
      setReviews(data)
    } catch (err) {
      console.error("Failed to load reviews:", err)
    } finally {
      setLoading(false)
    }
  }

  const myReview = reviews.find((r) => r.user_id === user?.id)
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Please select a rating", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        const updated = await coursesService.updateReview(editingId, {
          rating,
          comment: comment || undefined,
        })
        setReviews((prev) => prev.map((r) => (r.id === editingId ? updated : r)))
        toast({ title: "Review updated", variant: "success" })
      } else {
        const created = await coursesService.submitReview(courseId, {
          rating,
          comment: comment || undefined,
        })
        setReviews((prev) => [created, ...prev])
        toast({ title: "Review submitted", variant: "success" })
      }
      setRating(0)
      setComment("")
      setEditingId(null)
    } catch (err) {
      console.error("Failed to submit review:", err)
      toast({ title: "Failed to submit review", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (review: CourseReview) => {
    setEditingId(review.id)
    setRating(review.rating)
    setComment(review.comment || "")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setRating(0)
    setComment("")
  }

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Delete your review?")) return
    try {
      await coursesService.deleteReview(reviewId)
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      toast({ title: "Review deleted", variant: "success" })
    } catch (err) {
      console.error("Failed to delete review:", err)
      toast({ title: "Failed to delete review", variant: "destructive" })
    }
  }

  const hasApprovedCert = certificate?.status === "approved"
  const showForm = isEnrolled && user && hasApprovedCert && (!myReview || editingId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Reviews
          {reviews.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              ({reviews.length})
            </span>
          )}
        </CardTitle>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <StarDisplay rating={avgRating} size="lg" />
            <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              out of 5 · {reviews.length} review{reviews.length !== 1 && "s"}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isEnrolled && user && !hasApprovedCert && !myReview && (
          <div className="border rounded-lg p-4 bg-muted/30 flex items-center gap-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            Complete the course and receive your certificate to leave a review.
          </div>
        )}

        {/* Review Form */}
        {showForm && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <h4 className="text-sm font-medium">
              {editingId ? "Edit Your Review" : "Write a Review"}
            </h4>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Your rating</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        value <= (hoverRating || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {rating}/5
                  </span>
                )}
              </div>
            </div>
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about this course... (optional)"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSubmit} disabled={submitting} size="sm">
                {submitting
                  ? "Submitting..."
                  : editingId
                    ? "Update Review"
                    : "Submit Review"}
              </Button>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No reviews yet. Be the first to review this course!
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={review.rating} />
                    <span className="text-sm font-medium">
                      {review.reviewer_name || "Anonymous"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                    {review.user_id === user?.id && !editingId && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEdit(review)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(review.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const iconClass = size === "lg" ? "h-5 w-5" : "h-4 w-4"

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = value <= Math.round(rating)
        return (
          <Star
            key={value}
            className={`${iconClass} ${
              filled
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        )
      })}
    </div>
  )
}
