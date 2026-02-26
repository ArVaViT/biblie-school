import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { LogOut, LayoutDashboard, GraduationCap, BookOpenCheck } from "lucide-react"

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const roleIcon =
    user?.role === "teacher" ? (
      <BookOpenCheck className="h-4 w-4" />
    ) : (
      <GraduationCap className="h-4 w-4" />
    )

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Bible School
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground border rounded-full px-3 py-1">
                {roleIcon}
                <span className="capitalize">{user.role}</span>
              </div>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-4 w-4 mr-1.5" />
                  Dashboard
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
