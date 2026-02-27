import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import {
  LogOut, LayoutDashboard, GraduationCap, BookOpenCheck,
  Moon, Sun, User as UserIcon, PenTool,
} from "lucide-react"

export default function Header() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const isTeacher = user?.role === "teacher" || user?.role === "admin"

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
          Bible School
        </Link>

        <nav className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 p-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-2.5 py-1">
                {isTeacher ? (
                  <BookOpenCheck className="h-3.5 w-3.5" />
                ) : (
                  <GraduationCap className="h-3.5 w-3.5" />
                )}
                <span className="capitalize">{user.role}</span>
              </div>

              {isTeacher && (
                <Link to="/teacher">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    <PenTool className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Manage</span>
                  </Button>
                </Link>
              )}

              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>

              <Link to="/profile">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover mr-1" />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5 mr-1" />
                  )}
                  <span className="hidden sm:inline">Profile</span>
                </Button>
              </Link>

              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Sign Out</span>
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
      </div>
    </header>
  )
}
