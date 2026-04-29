import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Mail } from "lucide-react"
import { useAuth } from "@/context/useAuth"

const SUPPORT_EMAIL = "support@bibleschool.com"

export default function Footer() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const year = new Date().getFullYear()
  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const isAdmin = user?.role === "admin"

  const linkClass =
    "inline-flex text-sm font-medium text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="container mx-auto max-w-[1400px] px-4">
        <div className="flex flex-col gap-10 py-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="max-w-md shrink-0">
            <Link
              to="/"
              className="font-serif text-lg font-semibold tracking-tight text-foreground hover:opacity-85 transition-opacity"
            >
              {t("common.appName")}
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
          </div>

          <div className="flex flex-1 flex-col gap-10 sm:flex-row sm:flex-wrap sm:justify-start lg:justify-end lg:gap-x-16 lg:gap-y-8">
            <div className="min-w-[10rem]">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("footer.explore")}
              </h3>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <Link to="/" className={linkClass}>
                    {t("header.courses")}
                  </Link>
                </li>
                <li>
                  <Link to="/calendar" className={linkClass}>
                    {t("header.calendar")}
                  </Link>
                </li>
                <li>
                  <Link to="/certificates" className={linkClass}>
                    {t("header.certificates")}
                  </Link>
                </li>
              </ul>
            </div>

            {user && (isTeacher || isAdmin) && (
              <div className="min-w-[10rem]">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("footer.teaching")}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {isTeacher && (
                    <li>
                      <Link to="/teacher" className={linkClass}>
                        {t("footer.teacherDashboard")}
                      </Link>
                    </li>
                  )}
                  {isAdmin && (
                    <li>
                      <Link to="/admin" className={linkClass}>
                        {t("header.adminPanel")}
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="min-w-[10rem]">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("footer.support")}
              </h3>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className={`${linkClass} items-center gap-2`}
              >
                <Mail className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/80 py-6">
          <p className="text-center text-[13px] text-muted-foreground sm:text-left">
            © {year} {t("common.appName")}. {t("footer.rightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  )
}
