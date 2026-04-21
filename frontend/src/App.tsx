import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { useAuth } from "./context/useAuth"
import { usePageTitle } from "./hooks/usePageTitle"
import ErrorBoundary from "./components/ErrorBoundary"
import { Toaster } from "./components/ui/toaster"
import { ConfirmProvider } from "./components/ui/alert-dialog"
import Header from "./components/layout/Header"
import AnnouncementBanner from "./components/announcements/AnnouncementBanner"
import NotFound from "./pages/NotFound"
import PageSpinner from "./components/ui/PageSpinner"

const Login = lazy(() => import("./pages/Auth/Login"))
const Register = lazy(() => import("./pages/Auth/Register"))
const ForgotPassword = lazy(() => import("./pages/Auth/ForgotPassword"))
const ResetPassword = lazy(() => import("./pages/Auth/ResetPassword"))
const AuthCallback = lazy(() => import("./pages/Auth/AuthCallback"))
const HomePage = lazy(() => import("./pages/Home/HomePage"))
const ProfilePage = lazy(() => import("./pages/Profile/ProfilePage"))
const CourseDetail = lazy(() => import("./pages/Course/CourseDetail"))
const ModuleView = lazy(() => import("./pages/Course/ModuleView"))
const TeacherDashboard = lazy(() => import("./pages/Teacher/TeacherDashboard"))
const CertificatesPage = lazy(() => import("./pages/Certificates/CertificatesPage"))
const CourseEditor = lazy(() => import("./pages/Teacher/CourseEditor"))
const ModuleEditor = lazy(() => import("./pages/Teacher/ModuleEditor"))
const TeacherGradebook = lazy(() => import("./pages/Teacher/TeacherGradebook"))
const TeacherAnalytics = lazy(() => import("./pages/Teacher/TeacherAnalytics"))
const StudentProgress = lazy(() => import("./pages/Teacher/StudentProgress"))
const ChapterView = lazy(() => import("./pages/Course/ChapterView"))
const ChapterEditor = lazy(() => import("./pages/Teacher/ChapterEditor"))
const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"))
const CalendarPage = lazy(() => import("./pages/Calendar/CalendarPage"))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "teacher" && user.role !== "admin") {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "admin") {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function PendingTeacherBanner() {
  return (
    <div className="border-b bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
      <div className="container mx-auto px-4 py-3 text-center">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Your teacher account is pending administrator approval. You can browse courses as a student in the meantime.
          {" "}Contact <a href="mailto:support@bibleschool.com" className="underline font-medium hover:no-underline">support</a> if you have questions.
        </p>
      </div>
    </div>
  )
}

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/auth/reset-password", "/auth/callback", "/auth/confirm"]

function AppRoutes() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const isAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p))
  usePageTitle()

  if (loading) {
    return <PageSpinner variant="screen" label="Loading..." />
  }

  if (isAuthPage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/confirm" element={<AuthCallback />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      {user?.role === "pending_teacher" && <PendingTeacherBanner />}
      <AnnouncementBanner />
      <main className="flex-1">
        <ErrorBoundary>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
              <Route path="/calendar" element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
              <Route path="/certificates" element={<PrivateRoute><CertificatesPage /></PrivateRoute>} />
              <Route path="/courses/:id" element={<PrivateRoute><CourseDetail /></PrivateRoute>} />
              <Route path="/courses/:courseId/modules/:moduleId" element={<PrivateRoute><ModuleView /></PrivateRoute>} />
              <Route path="/courses/:courseId/modules/:moduleId/chapters/:chapterId" element={<PrivateRoute><ChapterView /></PrivateRoute>} />
              <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId" element={<TeacherRoute><CourseEditor /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId/modules/:moduleId/edit" element={<TeacherRoute><ModuleEditor /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId/modules/:moduleId/chapters/:chapterId/edit" element={<TeacherRoute><ChapterEditor /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId/analytics" element={<TeacherRoute><TeacherAnalytics /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId/gradebook" element={<TeacherRoute><TeacherGradebook /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId/progress" element={<TeacherRoute><StudentProgress /></TeacherRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="border-t border-border/60 bg-card/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-accent"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
              <span className="font-serif text-sm font-semibold tracking-tight">Bible School</span>
            </div>
            <p className="text-[11px] text-muted-foreground italic font-serif">Training servants for the work of ministry</p>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span>&copy; {new Date().getFullYear()} Bible School</span>
            </div>
          </div>
        </div>
      </footer>
      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </AuthProvider>
      </ThemeProvider>
      {/* Vercel Analytics (page views) + Speed Insights (Web Vitals).
          Both only emit from the deployed *.vercel.app domain — local dev
          silently no-ops, so there's no need to gate these behind env vars. */}
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  )
}
