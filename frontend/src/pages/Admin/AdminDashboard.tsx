import { useEffect, useState, useMemo } from "react"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { coursesService } from "@/services/courses"
import { supabase } from "@/lib/supabase"
import type { UserRole } from "@/types"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Users, BookOpen, GraduationCap, Shield, Search, Clock, CheckCircle, XCircle } from "lucide-react"

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  avatar_url: string | null
}

interface Stats {
  users: number
  courses: number
  enrollments: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [stats, setStats] = useState<Stats>({ users: 0, courses: 0, enrollments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
        const [allUsers, coursesCount, enrollmentsCount] = await Promise.all([
          coursesService.getAllUsers(),
          supabase.from("courses").select("id", { count: "exact", head: true }),
          supabase.from("enrollments").select("id", { count: "exact", head: true }),
        ])

        setUsers(allUsers as ProfileRow[])
        setStats({
          users: allUsers.length,
          courses: coursesCount.count ?? 0,
          enrollments: enrollmentsCount.count ?? 0,
        })
      } catch (err) {
        console.error("Failed to load admin data:", err)
        setError("Failed to load admin data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [users, search])

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId)
    try {
      await coursesService.updateUserRole(userId, newRole)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      )
      toast({ title: "Role updated", variant: "success" })
    } catch (err) {
      console.error("Failed to update role:", err)
      toast({ title: "Failed to update role", variant: "destructive" })
    } finally {
      setUpdatingId(null)
    }
  }

  const statCards = [
    { label: "Total Users", value: stats.users, icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400" },
    { label: "Total Courses", value: stats.courses, icon: BookOpen, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400" },
    { label: "Total Enrollments", value: stats.enrollments, icon: GraduationCap, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-400" },
  ]

  const pendingTeachers = users.filter((u) => u.role === "pending_teacher")

  const handleApproveTeacher = async (userId: string) => {
    setUpdatingId(userId)
    try {
      await coursesService.updateUserRole(userId, "teacher")
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: "teacher" as UserRole } : u)),
      )
      toast({ title: "Teacher approved", variant: "success" })
    } catch (err) {
      console.error("Failed to approve teacher:", err)
      toast({ title: "Failed to approve teacher", variant: "destructive" })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDenyTeacher = async (userId: string) => {
    setUpdatingId(userId)
    try {
      await coursesService.updateUserRole(userId, "student")
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: "student" as UserRole } : u)),
      )
      toast({ title: "Teacher denied", variant: "success" })
    } catch (err) {
      console.error("Failed to deny teacher:", err)
      toast({ title: "Failed to deny teacher", variant: "destructive" })
    } finally {
      setUpdatingId(null)
    }
  }

  const roleBadgeClass: Record<UserRole, string> = {
    admin: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    teacher: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    pending_teacher: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    student: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-0.5">Manage users, roles, and monitor platform activity</p>
        </div>
      </div>

      {error && (
        <Card className="mb-8 border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-destructive/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={load} size="sm" variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && <>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`p-3 rounded-xl ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">
                  {loading ? "—" : s.value.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Teacher Approvals */}
      {pendingTeachers.length > 0 && (
        <Card className="mb-8 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Pending Teacher Approvals
              <span className="text-sm font-normal bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full px-2.5 py-0.5">
                {pendingTeachers.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTeachers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {(u.full_name?.[0] ?? u.email[0]).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.full_name || "No name"}</p>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Registered {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleApproveTeacher(u.id)}
                      disabled={updatingId === u.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDenyTeacher(u.id)}
                      disabled={updatingId === u.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-xl">Users</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {search ? "No users match your search" : "No users found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-6 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {(u.full_name?.[0] ?? u.email[0]).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{u.full_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadgeClass[u.role]}`}>
                            {u.role}
                          </span>
                          <select
                            value={u.role}
                            disabled={updatingId === u.id || u.id === user?.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                          >
                            <option value="student">student</option>
                            <option value="pending_teacher">pending teacher</option>
                            <option value="teacher">teacher</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4 px-6">
              Showing {filtered.length} of {users.length} users
            </p>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  )
}
