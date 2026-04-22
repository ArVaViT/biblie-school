import { useEffect, useState, useMemo, useCallback } from "react"
import { Navigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/useAuth"
import { coursesService } from "@/services/courses"
import { getErrorDetail } from "@/lib/errorDetail"
import { supabase } from "@/lib/supabase"
import type { UserRole, Certificate, AuditLogEntry } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import {
  Users, BookOpen, GraduationCap, Shield, Search, Clock,
  CheckCircle, XCircle, Award, FileText, ChevronLeft, ChevronRight,
} from "lucide-react"
import { toProxyImage } from "@/lib/images"
import { useConfirm } from "@/components/ui/alert-dialog"
import VirtualAdminUsers from "./VirtualAdminUsers"
import PageSpinner from "@/components/ui/PageSpinner"

// Above this row count we swap the full <table> render for a react-window list.
// Small tenants keep the familiar semantic table; large tenants avoid paying
// 500 avatar images + 500 <select> elements worth of DOM on mount.
const USERS_VIRTUAL_THRESHOLD = 50

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

type Tab = "overview" | "audit"

const ACTION_OPTIONS = ["create", "update", "delete", "publish", "enroll", "approve", "reject", "grade"]
const RESOURCE_OPTIONS = ["course", "module", "chapter", "enrollment", "certificate", "assignment_submission", "user"]

const actionBadgeClass: Record<string, string> = {
  create: "bg-success/15 text-success",
  update: "bg-info/15 text-info",
  delete: "bg-destructive/15 text-destructive",
  publish: "bg-primary/15 text-primary",
  enroll: "bg-info/15 text-info",
  approve: "bg-success/15 text-success",
  reject: "bg-destructive/15 text-destructive",
  grade: "bg-warning/15 text-warning",
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>("overview")
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [stats, setStats] = useState<Stats>({ users: 0, courses: 0, enrollments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRole, setBulkRole] = useState<UserRole>("student")
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [adminCerts, setAdminCerts] = useState<(Certificate & { student_name?: string; course_title?: string; approved_by_name?: string; approved_at?: string })[]>([])
  const [certActionId, setCertActionId] = useState<string | null>(null)

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditAction, setAuditAction] = useState("")
  const [auditResource, setAuditResource] = useState("")
  const [auditDateFrom, setAuditDateFrom] = useState("")
  const [auditDateTo, setAuditDateTo] = useState("")
  const auditPageSize = 25

  const load = async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const [allUsers, coursesCount, enrollmentsCount, certs] = await Promise.all([
        coursesService.getAllUsers(),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("enrollments").select("id", { count: "exact", head: true }),
        coursesService.getAdminPendingCerts().catch(() => []),
      ])
      if (signal?.cancelled) return

      setUsers(allUsers as ProfileRow[])
      setStats({
        users: allUsers.length,
        courses: coursesCount.count ?? 0,
        enrollments: enrollmentsCount.count ?? 0,
      })
      setAdminCerts(certs)
    } catch {
      if (!signal?.cancelled) setError("Failed to load admin data. Please try again.")
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }

  const loadAuditLogs = useCallback(async (signal?: { cancelled: boolean }) => {
    setAuditLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: auditPage,
        page_size: auditPageSize,
      }
      if (auditAction) params.action = auditAction
      if (auditResource) params.resource_type = auditResource
      if (auditDateFrom) params.date_from = new Date(auditDateFrom).toISOString()
      if (auditDateTo) params.date_to = new Date(auditDateTo + "T23:59:59").toISOString()

      const data = await coursesService.getAuditLogs(params)
      if (signal?.cancelled) return
      setAuditLogs(data.items ?? [])
      setAuditTotal(data.total ?? 0)
    } catch (error: unknown) {
      if (signal?.cancelled) return
      const detail = getErrorDetail(error) || "The audit_logs table may not exist yet. Deploy the latest migration."
      toast({ title: `Audit log error: ${detail}`, variant: "destructive" })
    } finally {
      if (!signal?.cancelled) setAuditLoading(false)
    }
  }, [auditPage, auditAction, auditResource, auditDateFrom, auditDateTo])

  useEffect(() => {
    const signal = { cancelled: false }
    load(signal)
    return () => { signal.cancelled = true }
  }, [])

  useEffect(() => {
    if (tab !== "audit") return
    const signal = { cancelled: false }
    loadAuditLogs(signal)
    return () => { signal.cancelled = true }
  }, [tab, loadAuditLogs])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [users, search])
  const userMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const u of users) map[u.id] = u.full_name || u.email
    return map
  }, [users])
  const totalAuditPages = Math.max(1, Math.ceil(auditTotal / auditPageSize))

  const filteredIds = useMemo(() => new Set(filtered.map((u) => u.id)), [filtered])

  useEffect(() => {
    setSelectedIds(prev => {
      const narrowed = new Set([...prev].filter(id => filteredIds.has(id)))
      return narrowed.size === prev.size ? prev : narrowed
    })
  }, [filteredIds])

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId)
    try {
      await coursesService.updateUserRole(userId, newRole)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      )
      toast({ title: "Role updated", variant: "success" })
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" })
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleSelectAll = () => {
    const allFilteredSelected = filtered.length > 0 && filtered.every(u => selectedIds.has(u.id))
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkRoleChange = async () => {
    const ids = [...selectedIds].filter((id) => id !== user?.id)
    if (ids.length === 0) return
    const ok = await confirm({
      title: "Change role for selected users?",
      description: `${ids.length} user(s) will be set to role "${bulkRole}".`,
      confirmLabel: "Apply",
    })
    if (!ok) return
    setBulkUpdating(true)
    try {
      const result = await coursesService.bulkUpdateUserRoles(ids, bulkRole)
      setUsers((prev) =>
        prev.map((u) => (ids.includes(u.id) ? { ...u, role: bulkRole } : u)),
      )
      setSelectedIds(new Set())
      toast({ title: `Updated ${result.updated} user(s) to ${bulkRole}`, variant: "success" })
    } catch (err) {
      toast({ title: getErrorDetail(err, "Bulk update failed"), variant: "destructive" })
    } finally {
      setBulkUpdating(false)
    }
  }

  const statCards = [
    { label: "Total Users", value: stats.users, icon: Users },
    { label: "Total Courses", value: stats.courses, icon: BookOpen },
    { label: "Total Enrollments", value: stats.enrollments, icon: GraduationCap },
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
    } catch {
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
    } catch {
      toast({ title: "Failed to deny teacher", variant: "destructive" })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleFinalApproveCert = async (certId: string) => {
    setCertActionId(certId)
    try {
      await coursesService.adminApproveCert(certId)
      setAdminCerts((prev) => prev.filter((c) => c.id !== certId))
      toast({ title: "Certificate approved", variant: "success" })
    } catch {
      toast({ title: "Failed to approve certificate", variant: "destructive" })
    } finally {
      setCertActionId(null)
    }
  }

  const handleRejectCert = async (certId: string) => {
    setCertActionId(certId)
    try {
      await coursesService.rejectCert(certId)
      setAdminCerts((prev) => prev.filter((c) => c.id !== certId))
      toast({ title: "Certificate rejected", variant: "success" })
    } catch {
      toast({ title: "Failed to reject certificate", variant: "destructive" })
    } finally {
      setCertActionId(null)
    }
  }

  const roleDisplayNames: Record<UserRole, string> = {
    student: "Student",
    pending_teacher: "Pending Teacher",
    teacher: "Teacher",
    admin: "Admin",
  }

  const roleBadgeClass: Record<UserRole, string> = {
    admin: "bg-destructive/15 text-destructive",
    teacher: "bg-primary/15 text-primary",
    pending_teacher: "bg-warning/15 text-warning",
    student: "bg-info/15 text-info",
  }

  const resetAuditFilters = () => {
    setAuditAction("")
    setAuditResource("")
    setAuditDateFrom("")
    setAuditDateTo("")
    setAuditPage(1)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-0.5">Manage users, roles, and monitor platform activity</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b">
        <button
          onClick={() => setTab("overview")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            tab === "overview"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Overview
          </div>
          {tab === "overview" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          )}
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            tab === "audit"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Log
          </div>
          {tab === "audit" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          )}
        </button>
      </div>

      {error && (
        <Card className="mb-8 border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-destructive/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => load()} size="sm" variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && tab === "overview" && <>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-md bg-muted p-3">
                <s.icon className="h-6 w-6 text-muted-foreground" />
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
        <Card className="mb-8 border-l-[3px] border-l-warning">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Pending Teacher Approvals
              <Badge variant="warning" className="font-normal">
                {pendingTeachers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTeachers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-md border border-l-[3px] border-l-warning/60 bg-warning/5 p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar_url ? (
                      <img src={toProxyImage(u.avatar_url)} alt={`${u.full_name ?? u.email} avatar`} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {(u.full_name?.[0] ?? u.email[0] ?? "?").toUpperCase()}
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
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Approve this teacher?",
                          description: `${u.full_name || u.email} will gain access to teacher features.`,
                          confirmLabel: "Approve",
                        })
                        if (ok) handleApproveTeacher(u.id)
                      }}
                      disabled={updatingId === u.id}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Deny this teacher?",
                          description: `${u.full_name || u.email}'s teacher request will be rejected.`,
                          confirmLabel: "Deny",
                          tone: "destructive",
                        })
                        if (ok) handleDenyTeacher(u.id)
                      }}
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

      {/* Certificate Approvals */}
      {adminCerts.length > 0 && (
        <Card className="mb-8 border-l-[3px] border-l-primary">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Certificate Approvals
              <Badge variant="default" className="font-normal">
                {adminCerts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adminCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between rounded-md border border-l-[3px] border-l-primary/60 bg-primary/5 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{cert.student_name || "Student"}</p>
                    <p className="text-sm text-muted-foreground truncate">{cert.course_title || "Course"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {cert.approved_by_name && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-success" />
                          Approved by {cert.approved_by_name}
                        </span>
                      )}
                      {cert.approved_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(cert.approved_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleFinalApproveCert(cert.id)}
                      disabled={certActionId === cert.id}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectCert(cert.id)}
                      disabled={certActionId === cert.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Reject
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
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 flex-wrap">
          <CardTitle className="text-xl">Users</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium">{selectedIds.size} selected</span>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value as UserRole)}
                  className="h-7 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="student">Student</option>
                  <option value="pending_teacher">Pending Teacher</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
                <Button size="sm" className="h-7 text-xs" onClick={handleBulkRoleChange} disabled={bulkUpdating}>
                  {bulkUpdating ? "Updating..." : "Apply"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            )}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageSpinner />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {search ? "No users match your search" : "No users found"}
              </p>
            </div>
          ) : filtered.length >= USERS_VIRTUAL_THRESHOLD ? (
            <>
              <div className="flex items-center gap-3 px-3 pb-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(u => selectedIds.has(u.id))}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-input"
                  aria-label="Select all users"
                />
                <span className="text-xs text-muted-foreground">Select all {filtered.length}</span>
              </div>
              <VirtualAdminUsers
                users={filtered}
                selectedIds={selectedIds}
                updatingId={updatingId}
                currentUserId={user?.id}
                roleBadgeClass={roleBadgeClass}
                roleDisplayNames={roleDisplayNames}
                onToggleSelect={toggleSelect}
                onRoleChange={handleRoleChange}
              />
            </>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every(u => selectedIds.has(u.id))}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-input"
                        aria-label="Select all users"
                      />
                    </th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u) => (
                    <tr key={u.id} className={`hover:bg-muted/50 transition-colors ${selectedIds.has(u.id) ? "bg-primary/[0.03]" : ""}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelect(u.id)}
                          className="h-4 w-4 rounded border-input"
                          aria-label={`Select ${u.full_name || u.email}`}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={toProxyImage(u.avatar_url)}
                              alt={`${u.full_name ?? u.email} avatar`}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {(u.full_name?.[0] ?? u.email[0] ?? "?").toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{u.full_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadgeClass[u.role]}`}>
                            {roleDisplayNames[u.role]}
                          </span>
                          <select
                            value={u.role}
                            disabled={updatingId === u.id || u.id === user?.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                          >
                            <option value="student">Student</option>
                            <option value="pending_teacher">Pending Teacher</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
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

      {/* Audit Log Tab */}
      {!error && tab === "audit" && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Action</label>
                  <select
                    value={auditAction}
                    onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1) }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All actions</option>
                    {ACTION_OPTIONS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Resource</label>
                  <select
                    value={auditResource}
                    onChange={(e) => { setAuditResource(e.target.value); setAuditPage(1) }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All resources</option>
                    {RESOURCE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={auditDateFrom}
                    onChange={(e) => { setAuditDateFrom(e.target.value); setAuditPage(1) }}
                    className="h-9 w-40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={auditDateTo}
                    onChange={(e) => { setAuditDateTo(e.target.value); setAuditPage(1) }}
                    className="h-9 w-40"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={resetAuditFilters} className="h-9">
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {auditTotal.toLocaleString()} entries
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <PageSpinner />
              ) : auditLogs.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No audit logs found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-6 py-3 font-medium text-muted-foreground">Date</th>
                          <th className="px-6 py-3 font-medium text-muted-foreground">User</th>
                          <th className="px-6 py-3 font-medium text-muted-foreground">Action</th>
                          <th className="px-6 py-3 font-medium text-muted-foreground">Resource</th>
                          <th className="px-6 py-3 font-medium text-muted-foreground">Resource ID</th>
                          <th className="px-6 py-3 font-medium text-muted-foreground">IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 max-w-[160px] truncate" title={log.user_id ?? ""}>
                              {log.user_id ? (userMap[log.user_id] || log.user_id.slice(0, 8) + "…") : "—"}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${actionBadgeClass[log.action] || "bg-muted text-muted-foreground"}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-muted-foreground">{log.resource_type}</td>
                            <td className="px-6 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate" title={log.resource_id}>
                              {log.resource_id.length > 12 ? log.resource_id.slice(0, 12) + "…" : log.resource_id}
                            </td>
                            <td className="px-6 py-3 text-muted-foreground text-xs">
                              {log.ip_address || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-4 px-6">
                    <p className="text-xs text-muted-foreground">
                      Page {auditPage} of {totalAuditPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage <= 1}
                        onClick={() => setAuditPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage >= totalAuditPages}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
