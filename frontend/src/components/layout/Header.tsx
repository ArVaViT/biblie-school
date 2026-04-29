import { lazy, Suspense, useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/context/useAuth"
import {
  PenTool,
  ShieldCheck,
  User as UserIcon,
  Menu,
  CalendarDays,
  Award,
} from "lucide-react"
import { toProxyImage } from "@/lib/images"
import LanguageSwitcher from "@/components/layout/LanguageSwitcher"

const NotificationBell = lazy(() => import("./NotificationBell"))

const ICON_STROKE = 1.75 as const

function NavLinkButton({
  to,
  active,
  children,
}: {
  to: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link to={to}>
      <Button
        variant={active ? "secondary" : "ghost"}
        size="sm"
        className={`h-8 rounded-full px-3 text-xs font-medium ${active ? "shadow-none" : ""}`}
      >
        {children}
      </Button>
    </Link>
  )
}

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const mobileNavLinkClass =
    "flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted active:bg-muted/80"

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto max-w-[1400px] px-4">
        <div className="flex h-14 items-center justify-between gap-3 md:h-[3.5rem] md:gap-4">
          <Link
            to="/"
            className="shrink-0 font-serif text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-85"
          >
            {t("common.appName")}
          </Link>

          {user ? (
            <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
              <nav
                className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-full border border-border/80 bg-muted/40 p-1 shadow-none"
                aria-label={t("header.navAriaLabel")}
              >
                <NavLinkButton to="/" active={location.pathname === "/"}>
                  {t("header.courses")}
                </NavLinkButton>
                <Link to="/calendar">
                  <Button
                    variant={isActive("/calendar") ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 w-8 rounded-full p-0"
                    aria-label={t("header.calendar")}
                    title={t("header.calendar")}
                  >
                    <CalendarDays className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  </Button>
                </Link>
                <NavLinkButton to="/certificates" active={isActive("/certificates")}>
                  <span className="flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                    {t("header.certificates")}
                  </span>
                </NavLinkButton>
                {isTeacher && (
                  <NavLinkButton to="/teacher" active={isActive("/teacher")}>
                    <span className="flex items-center gap-1">
                      <PenTool className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                      {t("header.manage")}
                    </span>
                  </NavLinkButton>
                )}
                {user.role === "admin" && (
                  <NavLinkButton to="/admin" active={isActive("/admin")}>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
                      {t("header.admin")}
                    </span>
                  </NavLinkButton>
                )}
              </nav>
            </div>
          ) : (
            <div className="hidden flex-1 md:block" aria-hidden />
          )}

          <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
            <div className="hidden items-center gap-1 md:flex">
              {user ? (
                <>
                  <Suspense fallback={<div className="h-8 w-8 shrink-0" aria-hidden />}>
                    <NotificationBell />
                  </Suspense>
                  <LanguageSwitcher variant="compact" />
                  <Link to="/profile">
                    <Button
                      variant={isActive("/profile") ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 w-8 shrink-0 rounded-full p-0"
                      aria-label={t("header.profile")}
                    >
                      {user.avatar_url ? (
                        <img
                          src={toProxyImage(user.avatar_url)}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      ) : (
                        <UserIcon className="h-4 w-4" strokeWidth={ICON_STROKE} />
                      )}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <LanguageSwitcher variant="compact" />
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-medium">
                      {t("common.signIn")}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" className="h-8 px-3 text-xs font-medium">
                      {t("common.register")}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-0.5 md:hidden">
              <LanguageSwitcher variant="compact" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                onClick={() => setMobileOpen(true)}
                aria-label={t("header.menu")}
                aria-expanded={mobileOpen}
              >
                <Menu className="h-5 w-5" strokeWidth={ICON_STROKE} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="flex flex-col overflow-hidden p-0">
          <SheetHeader>
            <SheetTitle>{t("header.mobileMenuTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("header.mobileMenuDescription")}</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-4" aria-label={t("header.navAriaLabel")}>
            {user ? (
              <>
                <Link to="/" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                  {t("header.courses")}
                </Link>
                <Link to="/calendar" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                  {t("header.calendar")}
                </Link>
                <Link to="/certificates" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                  {t("header.certificates")}
                </Link>
                {isTeacher && (
                  <Link to="/teacher" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                    {t("header.manageCourses")}
                  </Link>
                )}
                {user.role === "admin" && (
                  <Link to="/admin" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                    {t("header.adminPanel")}
                  </Link>
                )}
                <div className="my-2 border-t border-border px-1 py-2">
                  <Suspense fallback={null}>
                    <NotificationBell
                      panelVariant="sheet"
                      onNotificationNavigate={() => setMobileOpen(false)}
                    />
                  </Suspense>
                </div>
                <Link to="/profile" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                  {t("header.profileAndSettings")}
                </Link>
              </>
            ) : (
              <>
                <Link to="/" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                  {t("header.courses")}
                </Link>
                <Link to="/login" className={mobileNavLinkClass} onClick={() => setMobileOpen(false)}>
                  {t("common.signIn")}
                </Link>
                <Link
                  to="/register"
                  className={`${mobileNavLinkClass} font-semibold text-primary`}
                  onClick={() => setMobileOpen(false)}
                >
                  {t("common.register")}
                </Link>
              </>
            )}
          </nav>
          <div className="border-t border-border bg-muted/20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("language.label")}
            </p>
            <LanguageSwitcher variant="full" />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
