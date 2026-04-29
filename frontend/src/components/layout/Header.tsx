import { lazy, Suspense, useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/context/useAuth"
import { User as UserIcon, Menu } from "lucide-react"
import { toProxyImage } from "@/lib/images"
import { cn } from "@/lib/utils"

const NotificationBell = lazy(() => import("./NotificationBell"))

const ICON_STROKE = 1.75 as const

function HeaderNavLink({
  to,
  active,
  children,
  onNavigate,
  variant = "bar",
}: {
  to: string
  active: boolean
  children: React.ReactNode
  onNavigate?: () => void
  variant?: "bar" | "sheet"
}) {
  const isSheet = variant === "sheet"
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "text-sm font-medium transition-colors",
        isSheet
          ? "flex min-h-11 w-full items-center rounded-md px-3 active:bg-muted/80"
          : "rounded-md px-3 py-2",
        active
          ? "bg-muted/80 text-foreground"
          : isSheet
            ? "text-foreground hover:bg-muted"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
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

  const closeMobile = () => setMobileOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90">
      <div className="container mx-auto max-w-[1400px] px-4">
        <div className="flex h-14 items-center justify-between gap-4 md:h-14">
          <Link
            to="/"
            className="shrink-0 font-serif text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-85"
          >
            {t("common.appName")}
          </Link>

          {user ? (
            <nav
              className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 md:flex"
              aria-label={t("header.navAriaLabel")}
            >
              <HeaderNavLink to="/" active={location.pathname === "/"}>
                {t("header.courses")}
              </HeaderNavLink>
              <HeaderNavLink to="/calendar" active={isActive("/calendar")}>
                {t("header.calendar")}
              </HeaderNavLink>
              <HeaderNavLink to="/certificates" active={isActive("/certificates")}>
                {t("header.certificates")}
              </HeaderNavLink>
              {isTeacher && (
                <HeaderNavLink to="/teacher" active={isActive("/teacher")}>
                  {t("header.manage")}
                </HeaderNavLink>
              )}
              {user.role === "admin" && (
                <HeaderNavLink to="/admin" active={isActive("/admin")}>
                  {t("header.admin")}
                </HeaderNavLink>
              )}
            </nav>
          ) : (
            <div className="hidden flex-1 md:block" aria-hidden />
          )}

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-1 md:flex">
              {user ? (
                <>
                  <Suspense fallback={<div className="h-8 w-8 shrink-0" aria-hidden />}>
                    <NotificationBell />
                  </Suspense>
                  <Link to="/profile">
                    <Button
                      variant={isActive("/profile") ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 w-8 shrink-0 rounded-full p-0"
                      aria-label={t("header.profile")}
                      title={t("header.profileAndSettings")}
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
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="h-8 px-3 text-sm font-medium">
                      {t("common.signIn")}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" className="h-8 px-3 text-sm font-medium">
                      {t("common.register")}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="flex md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-w-9 px-2 text-muted-foreground hover:text-foreground"
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
        <SheetContent
          side="right"
          className="flex max-h-[100dvh] flex-col gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="shrink-0 px-5 pb-4 pt-6">
            <SheetTitle className="font-sans text-base font-semibold tracking-normal text-foreground">
              {t("header.mobileMenuTitle")}
            </SheetTitle>
            <SheetDescription className="sr-only">{t("header.mobileMenuDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <nav
              className="flex flex-col gap-0.5 overflow-y-auto px-4 pb-2 pt-1"
              aria-label={t("header.navAriaLabel")}
            >
              {user ? (
                <>
                  <HeaderNavLink variant="sheet" to="/" active={location.pathname === "/"} onNavigate={closeMobile}>
                    {t("header.courses")}
                  </HeaderNavLink>
                  <HeaderNavLink variant="sheet" to="/calendar" active={isActive("/calendar")} onNavigate={closeMobile}>
                    {t("header.calendar")}
                  </HeaderNavLink>
                  <HeaderNavLink
                    variant="sheet"
                    to="/certificates"
                    active={isActive("/certificates")}
                    onNavigate={closeMobile}
                  >
                    {t("header.certificates")}
                  </HeaderNavLink>
                  {isTeacher && (
                    <HeaderNavLink variant="sheet" to="/teacher" active={isActive("/teacher")} onNavigate={closeMobile}>
                      {t("header.manageCourses")}
                    </HeaderNavLink>
                  )}
                  {user.role === "admin" && (
                    <HeaderNavLink variant="sheet" to="/admin" active={isActive("/admin")} onNavigate={closeMobile}>
                      {t("header.adminPanel")}
                    </HeaderNavLink>
                  )}
                  <div className="mt-2 border-t border-border/80 pt-2">
                    <Suspense fallback={null}>
                      <NotificationBell
                        triggerVariant="navRow"
                        panelVariant="sheet"
                        onNotificationNavigate={() => setMobileOpen(false)}
                      />
                    </Suspense>
                  </div>
                  <Link
                    to="/profile"
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted active:bg-muted/80"
                    onClick={closeMobile}
                  >
                    {t("header.profileAndSettings")}
                  </Link>
                </>
              ) : (
                <>
                  <HeaderNavLink variant="sheet" to="/" active={location.pathname === "/"} onNavigate={closeMobile}>
                    {t("header.courses")}
                  </HeaderNavLink>
                  <HeaderNavLink variant="sheet" to="/login" active={isActive("/login")} onNavigate={closeMobile}>
                    {t("common.signIn")}
                  </HeaderNavLink>
                  <Link
                    to="/register"
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-semibold text-primary transition-colors hover:bg-muted active:bg-muted/80"
                    onClick={closeMobile}
                  >
                    {t("common.register")}
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-auto border-t border-border/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <p className="text-xs text-muted-foreground">{t("common.appName")}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
