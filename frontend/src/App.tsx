import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import Header from "./components/layout/Header"
import Login from "./pages/Auth/Login"
import Register from "./pages/Auth/Register"
import ForgotPassword from "./pages/Auth/ForgotPassword"
import ResetPassword from "./pages/Auth/ResetPassword"
import AuthCallback from "./pages/Auth/AuthCallback"
import HomePage from "./pages/Home/HomePage"
import Dashboard from "./pages/Dashboard/Dashboard"
import ProfilePage from "./pages/Profile/ProfilePage"
import CourseDetail from "./pages/Course/CourseDetail"
import ModuleView from "./pages/Course/ModuleView"
import TeacherDashboard from "./pages/Teacher/TeacherDashboard"
import CourseEditor from "./pages/Teacher/CourseEditor"

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "teacher" && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/confirm" element={<AuthCallback />} />
          <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/courses/:courseId/modules/:moduleId" element={<ModuleView />} />
          <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
          <Route path="/teacher/courses/:courseId" element={<TeacherRoute><CourseEditor /></TeacherRoute>} />
        </Routes>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Bible School &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
