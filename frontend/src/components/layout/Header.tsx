import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import {
  LogOut, LayoutDashboard, GraduationCap, BookOpenCheck,
  Moon, Sun, User as UserIcon, PenTool, ShieldCheck,
  Menu, X, Award,
} from "lucide-react"

export default function Header() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    setMobileOpen(false)
    navigate("/login", { replace: true })
  }

  const closeMobile = () => setMobileOpen(false)

  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const isPendingTeacher = user?.role === "pending_teacher"

  const navLinkClass = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
      location.pathname === path
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
          Bible School
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 p-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <>
              <div className={`flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 ${
                isPendingTeacher
                  ? "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
                  : "text-muted-foreground"
              }`}>
                {isTeacher || isPendingTeacher ? (
                  <BookOpenCheck className="h-3.5 w-3.5" />
                ) : (
                  <GraduationCap className="h-3.5 w-3.5" />
                )}
                <span className="capitalize">
                  {isPendingTeacher ? "Pending Teacher" : user.role}
                </span>
              </div>

              {user.role === "admin" && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Admin
                  </Button>
                </Link>
              )}

              {isTeacher && (
                <Link to="/teacher">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    <PenTool className="h-3.5 w-3.5 mr-1" />
                    Manage
                  </Button>
                </Link>
              )}

              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                  Dashboard
                </Button>
              </Link>

              <Link to="/certificates">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <Award className="h-3.5 w-3.5 mr-1" />
                  Certificates
                </Button>
              </Link>

              <Link to="/profile">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover mr-1"
                      onError={(e) => { e.currentTarget.style.display = "none" }}
                    />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5 mr-1" />
                  )}
                  Profile
                </Button>
              </Link>

              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="h-8 text-xs">
                  Register
                </Button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1.5 md:hidden">
          <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 p-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background animate-in slide-in-from-top-2 duration-200">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {user ? (
              <>
                <div className={`flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 w-fit mb-2 ${
                  isPendingTeacher
                    ? "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
                    : "text-muted-foreground"
                }`}>
                  {isTeacher || isPendingTeacher ? (
                    <BookOpenCheck className="h-3.5 w-3.5" />
                  ) : (
                    <GraduationCap className="h-3.5 w-3.5" />
                  )}
                  <span className="capitalize">
                    {isPendingTeacher ? "Pending Teacher" : user.role}
                  </span>
                </div>

                {user.role === "admin" && (
                  <Link to="/admin" className={navLinkClass("/admin")} onClick={closeMobile}>
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </Link>
                )}

                {isTeacher && (
                  <Link to="/teacher" className={navLinkClass("/teacher")} onClick={closeMobile}>
                    <PenTool className="h-4 w-4" />
                    Manage Courses
                  </Link>
                )}

                <Link to="/dashboard" className={navLinkClass("/dashboard")} onClick={closeMobile}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>

                <Link to="/" className={navLinkClass("/")} onClick={closeMobile}>
                  <BookOpenCheck className="h-4 w-4" />
                  Browse Courses
                </Link>

                <Link to="/certificates" className={navLinkClass("/certificates")} onClick={closeMobile}>
                  <Award className="h-4 w-4" />
                  Certificates
                </Link>

                <Link to="/profile" className={navLinkClass("/profile")} onClick={closeMobile}>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none" }}
                    />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                  Profile
                </Link>

                <div className="border-t my-1" />

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={navLinkClass("/login")} onClick={closeMobile}>
                  Sign In
                </Link>
                <Link to="/register" onClick={closeMobile}>
                  <Button size="sm" className="w-full mt-1">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
