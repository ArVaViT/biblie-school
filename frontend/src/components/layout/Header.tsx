import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/useAuth"
import { useTheme } from "@/context/useTheme"
import { PenTool, ShieldCheck, User as UserIcon, Menu, X, CalendarDays, Sun, Moon } from "lucide-react"
import NotificationBell from "./NotificationBell"
import { toProxyImage } from "@/lib/images"

export default function Header() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)

  return (
    <header className="border-b border-border/60 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-serif text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity">
          Bible School
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {user ? (
            <>
              <Link to="/">
                <Button variant={isActive("/") ? "secondary" : "ghost"} size="sm" className="h-8 text-xs">
                  Courses
                </Button>
              </Link>
              <Link to="/calendar">
                <Button variant={isActive("/calendar") ? "secondary" : "ghost"} size="sm" className="h-8 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 mr-1" />
                  Calendar
                </Button>
              </Link>
              {isTeacher && (
                <Link to="/teacher">
                  <Button variant={isActive("/teacher") ? "secondary" : "ghost"} size="sm" className="h-8 text-xs">
                    <PenTool className="h-3.5 w-3.5 mr-1" />
                    Manage
                  </Button>
                </Link>
              )}
              {user.role === "admin" && (
                <Link to="/admin">
                  <Button variant={isActive("/admin") ? "secondary" : "ghost"} size="sm" className="h-8 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Admin
                  </Button>
                </Link>
              )}
              <NotificationBell />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Link to="/profile">
                <Button variant={isActive("/profile") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0 rounded-full" aria-label="Profile">
                  {user.avatar_url ? (
                    <img src={toProxyImage(user.avatar_url)} alt={`${user.full_name ?? "User"} avatar`} className="h-6 w-6 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none" }} />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm" className="h-8 text-xs">Sign In</Button></Link>
              <Link to="/register"><Button size="sm" className="h-8 text-xs">Register</Button></Link>
            </>
          )}
        </nav>

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {user ? (
              <>
                <Link to="/" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Courses</Link>
                <Link to="/calendar" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Calendar</Link>
                <Link to="/certificates" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Certificates</Link>
                {isTeacher && <Link to="/teacher" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Manage Courses</Link>}
                {user.role === "admin" && <Link to="/admin" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Admin Panel</Link>}
                <div className="px-3 py-1"><NotificationBell /></div>
                <button
                  type="button"
                  onClick={() => { toggleTheme(); setMobileOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted text-left"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                </button>
                <Link to="/profile" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Profile & Settings</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Sign In</Link>
                <Link to="/register" className="px-3 py-2 rounded-md text-sm hover:bg-muted font-medium" onClick={() => setMobileOpen(false)}>Register</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
