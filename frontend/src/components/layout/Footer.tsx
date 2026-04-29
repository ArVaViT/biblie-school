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
    "inline-flex text-sm font-medium text-foreground/90 underline-offset-4 transition-colors duration-200 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"

  const columnTitleClass = "mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"

  return (
    <footer className="mt-auto border-t border-border bg-background/85 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70">
      <div className="animate-fade-in border-b border-border/80 bg-muted/20">
        <div className="container mx-auto max-w-[1400px] px-4 py-10 md:px-6">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
            <div className="max-w-md shrink-0 lg:max-w-sm">
              <Link
                to="/"
                className="inline-block font-serif text-lg font-semibold tracking-tight text-foreground transition-opacity duration-200 hover:opacity-85"
              >
                {t("common.appName")}
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
            </div>

            <div className="flex flex-1 flex-wrap gap-x-12 gap-y-10 lg:min-w-0 lg:justify-end">
              <div className="min-w-[10rem]">
                <h3 className={columnTitleClass}>{t("footer.explore")}</h3>
                <ul className="stagger-fade-in flex flex-col gap-2.5">
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
                  <h3 className={columnTitleClass}>{t("footer.teaching")}</h3>
                  <ul className="stagger-fade-in flex flex-col gap-2.5">
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
                <h3 className={columnTitleClass}>{t("footer.support")}</h3>
                <a href={`mailto:${SUPPORT_EMAIL}`} className={`${linkClass} items-center gap-2`}>
                  <Mail className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-[1400px] px-4 py-4 md:px-6">
        <p className="text-center text-xs text-muted-foreground md:text-left">
          © {year} {t("common.appName")}. {t("footer.rightsReserved")}
        </p>
      </div>
    </footer>
  )
}
