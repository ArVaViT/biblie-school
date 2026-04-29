import { Link } from "react-router-dom"
import { ArrowLeft, Clock, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthLayout from "@/components/layout/AuthLayout"

interface Props {
  email: string
  isTeacher: boolean
}

/**
 * Post-register confirmation screen. Teachers get a second banner that
 * explains the additional admin-approval step before the course-creation
 * tools unlock.
 */
export function SuccessView({ email, isTeacher }: Props) {
  return (
    <AuthLayout
      heading={isTeacher ? "Application submitted" : "Check your email"}
      subheading={
        isTeacher
          ? "One more step before you can start teaching"
          : "Almost there — just one more step"
      }
    >
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-md ${
              isTeacher ? "bg-warning/10" : "bg-primary/10"
            }`}
          >
            {isTeacher ? (
              <Clock className="h-8 w-8 text-warning" />
            ) : (
              <MailCheck className="h-8 w-8 text-primary" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
              <br />
              Click the link in the email to activate your account.
            </p>
            {isTeacher && (
              <div className="mt-4 rounded-md border border-border border-l-[3px] border-l-warning bg-warning/5 p-3">
                <p className="text-sm leading-relaxed text-foreground">
                  After confirming your email, your teacher account will need to be approved by an
                  administrator. You'll be able to log in, but course creation tools will be
                  available once approved.
                </p>
              </div>
            )}
          </div>
        </div>
        <Link to="/login" className="block">
          <Button variant="outline" size="lg" className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign In
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}
