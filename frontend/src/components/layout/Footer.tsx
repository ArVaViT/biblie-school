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
    "inline-flex text-xs font-medium text-foreground/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm sm:text-sm"

  return (
    <footer className="mt-auto border-t border-border/90 bg-muted/25">
      <div className="container mx-auto max-w-[1400px] px-4">
        <div className="flex flex-col gap-6 py-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10 lg:py-7">
          <div className="max-w-sm shrink-0">
            <Link
              to="/"
              className="font-serif text-base font-semibold tracking-tight text-foreground transition-opacity hover:opacity-85"
            >
              {t("common.appName")}
            </Link>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{t("footer.tagline")}</p>
          </div>

          <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-x-10 sm:gap-y-5 lg:justify-end">
            <div className="min-w-[9rem]">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("footer.explore")}
              </h3>
              <ul className="flex flex-col gap-1.5">
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
              <div className="min-w-[9rem]">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("footer.teaching")}
                </h3>
                <ul className="flex flex-col gap-1.5">
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

            <div className="min-w-[9rem]">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("footer.support")}
              </h3>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className={`${linkClass} items-center gap-1.5`}
              >
                <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 py-3">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            © {year} {t("common.appName")}. {t("footer.rightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  )
}
