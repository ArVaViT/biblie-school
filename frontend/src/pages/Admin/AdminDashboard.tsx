import { useEffect, useState, useMemo, useCallback } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { useDebouncedSearchParam } from "@/hooks/useDebouncedSearchParam"
import { useAuth } from "@/context/useAuth"
import { coursesService } from "@/services/courses"
import type { AuditLogQuery } from "@/services/audit"
import { getErrorDetail } from "@/lib/errorDetail"
import { supabase } from "@/lib/supabase"
import type { UserRole, AuditLogEntry } from "@/types"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { Shield } from "lucide-react"
import { useConfirm } from "@/components/ui/alert-dialog"
import { ErrorState } from "@/components/patterns"
import {
  ADMIN_TABS,
  ISO_DATE_REGEX,
  ACTION_OPTIONS,
  RESOURCE_OPTIONS,
  type AdminTab,
  type ProfileRow,
  type AdminStats,
} from "./dashboard/constants"
import { AdminTabs } from "./dashboard/AdminTabs"
import { OverviewStats } from "./dashboard/OverviewStats"
import { PendingTeachersCard } from "./dashboard/PendingTeachersCard"
import { PendingCertsCard, type AdminCert } from "./dashboard/PendingCertsCard"
import { UsersCard } from "./dashboard/UsersCard"
import { AuditLogTab } from "./dashboard/AuditLogTab"

const AUDIT_PAGE_SIZE = 25

/**
 * Admin dashboard orchestrator. Owns every piece of mutable state
 * (users, stats, certs, audit filters, selection set, loaders) and
 * passes pure-presentation children in `dashboard/` the props they
 * need. The CSS here is intentionally minimal — the real UI work lives
 * in `dashboard/` tab-scoped components.
 */
export default function AdminDashboard() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()

  const rawTab = params.get("tab")
  const tab: AdminTab = ADMIN_TABS.includes(rawTab as AdminTab)
    ? (rawTab as AdminTab)
    : "overview"

  const {
    input: searchInput,
    setInput: setSearchInput,
    value: urlQuery,
    maxLength: MAX_SEARCH_LEN,
  } = useDebouncedSearchParam()

  const [users, setUsers] = useState<ProfileRow[]>([])
  const [stats, setStats] = useState<AdminStats>({ users: 0, courses: 0, enrollments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRole, setBulkRole] = useState<UserRole>("student")
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [adminCerts, setAdminCerts] = useState<AdminCert[]>([])
  const [certActionId, setCertActionId] = useState<string | null>(null)

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)

  const pickOption = <T extends readonly string[]>(
    val: string | null,
    opts: T,
  ): T[number] | "" =>
    val && (opts as readonly string[]).includes(val) ? (val as T[number]) : ""

  const auditAction = pickOption(params.get("ax"), ACTION_OPTIONS)
  const auditResource = pickOption(params.get("ar"), RESOURCE_OPTIONS)
  const auditDateFrom = ISO_DATE_REGEX.test(params.get("af") ?? "") ? params.get("af")! : ""
  const auditDateTo = ISO_DATE_REGEX.test(params.get("at") ?? "") ? params.get("at")! : ""
  const rawPage = Number.parseInt(params.get("ap") ?? "1", 10)
  const auditPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const updateAudit = useCallback(
    (patch: Record<string, string | null>, opts: { resetPage?: boolean } = {}) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v) n.set(k, v)
            else n.delete(k)
          }
          if (opts.resetPage) n.delete("ap")
          return n
        },
        { replace: true },
      ),
    [setParams],
  )

  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [allUsers, coursesCount, enrollmentsCount, certs] = await Promise.all([
          coursesService.getAllUsers(),
          supabase.from("courses").select("id", { count: "exact", head: true }),
          supabase.from("enrollments").select("id", { count: "exact", head: true }),
          coursesService.getAdminPendingCerts().catch(() => []),
        ])
        if (cancelled) return
        setUsers(allUsers as ProfileRow[])
        setStats({
          users: allUsers.length,
          courses: coursesCount.count ?? 0,
          enrollments: enrollmentsCount.count ?? 0,
        })
        setAdminCerts(certs)
      } catch {
        if (!cancelled) setError("Failed to load admin data. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useEffect(() => {
    if (tab !== "audit") return
    let cancelled = false
    setAuditLoading(true)
    ;(async () => {
      try {
        const query: AuditLogQuery = {
          page: auditPage,
          page_size: AUDIT_PAGE_SIZE,
        }
        if (auditAction) query.action = auditAction
        if (auditResource) query.resource_type = auditResource
        if (auditDateFrom) query.date_from = new Date(auditDateFrom).toISOString()
        if (auditDateTo) query.date_to = new Date(auditDateTo + "T23:59:59").toISOString()

        const data = await coursesService.getAuditLogs(query)
        if (cancelled) return
        setAuditLogs(data.items ?? [])
        setAuditTotal(data.total ?? 0)
      } catch (err: unknown) {
        if (cancelled) return
        const detail =
          getErrorDetail(err) ||
          "The audit_logs table may not exist yet. Deploy the latest migration."
        toast({ title: `Audit log error: ${detail}`, variant: "destructive" })
      } finally {
        if (!cancelled) setAuditLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, auditPage, auditAction, auditResource, auditDateFrom, auditDateTo])

  const setTab = (nextTab: AdminTab) => {
    const next = new URLSearchParams(params)
    if (nextTab === "overview") next.delete("tab")
    else next.set("tab", nextTab)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = urlQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) => u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [users, urlQuery])

  const userMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const u of users) map[u.id] = u.full_name || u.email
    return map
  }, [users])

  const filteredIds = useMemo(() => new Set(filtered.map((u) => u.id)), [filtered])

  useEffect(() => {
    setSelectedIds((prev) => {
      const narrowed = new Set([...prev].filter((id) => filteredIds.has(id)))
      return narrowed.size === prev.size ? prev : narrowed
    })
  }, [filteredIds])

  if (user?.role !== "admin") return <Navigate to="/" replace />

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId)
    try {
      await coursesService.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      toast({ title: "Role updated", variant: "success" })
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteUser = async (target: ProfileRow) => {
    const ok = await confirm({
      title: `Delete ${target.full_name || target.email}?`,
      description:
        "This permanently removes their account, enrollments, submissions, grades, certificates, and notifications. Courses they created will be kept but disassociated. This cannot be undone.",
      confirmLabel: "Delete account",
      tone: "destructive",
    })
    if (!ok) return
    setUpdatingId(target.id)
    try {
      await coursesService.adminDeleteUser(target.id)
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      setSelectedIds((prev) => {
        if (!prev.has(target.id)) return prev
        const next = new Set(prev)
        next.delete(target.id)
        return next
      })
      toast({ title: "User deleted", variant: "success" })
    } catch (err) {
      toast({
        title: getErrorDetail(err, "Failed to delete user"),
        variant: "destructive",
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleSelectAll = () => {
    const allFilteredSelected =
      filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id))
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
      toast({
        title: `Updated ${result.updated} user(s) to ${bulkRole}`,
        variant: "success",
      })
    } catch (err) {
      toast({
        title: getErrorDetail(err, "Bulk update failed"),
        variant: "destructive",
      })
    } finally {
      setBulkUpdating(false)
    }
  }

  const pendingTeachers = users.filter((u) => u.role === "pending_teacher")

  const handleApproveTeacherRaw = async (userId: string) => {
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

  const handleDenyTeacherRaw = async (userId: string) => {
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

  const approvePendingTeacher = async (u: ProfileRow) => {
    const ok = await confirm({
      title: "Approve this teacher?",
      description: `${u.full_name || u.email} will gain access to teacher features.`,
      confirmLabel: "Approve",
    })
    if (ok) handleApproveTeacherRaw(u.id)
  }

  const denyPendingTeacher = async (u: ProfileRow) => {
    const ok = await confirm({
      title: "Deny this teacher?",
      description: `${u.full_name || u.email}'s teacher request will be rejected.`,
      confirmLabel: "Deny",
      tone: "destructive",
    })
    if (ok) handleDenyTeacherRaw(u.id)
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

  const resetAuditFilters = () =>
    updateAudit({ ax: null, ar: null, af: null, at: null, ap: null })

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-0.5">
            Manage users, roles, and monitor platform activity
          </p>
        </div>
      </div>

      <AdminTabs active={tab} onChange={setTab} />

      {error && (
        <ErrorState
          icon={<Shield />}
          description={error}
          action={
            <Button onClick={reload} size="sm" variant="outline">
              Try again
            </Button>
          }
          className="mb-8"
        />
      )}

      {!error && tab === "overview" && (
        <>
          <OverviewStats stats={stats} loading={loading} />
          <PendingTeachersCard
            pending={pendingTeachers}
            updatingId={updatingId}
            onApprove={approvePendingTeacher}
            onDeny={denyPendingTeacher}
          />
          <PendingCertsCard
            certs={adminCerts}
            actionId={certActionId}
            onApprove={handleFinalApproveCert}
            onReject={handleRejectCert}
          />
          <UsersCard
            users={users}
            filtered={filtered}
            loading={loading}
            searchInput={searchInput}
            searchMaxLength={MAX_SEARCH_LEN}
            urlQuery={urlQuery}
            selectedIds={selectedIds}
            bulkRole={bulkRole}
            bulkUpdating={bulkUpdating}
            updatingId={updatingId}
            currentUserId={user?.id}
            onSearchInputChange={setSearchInput}
            onBulkRoleChange={setBulkRole}
            onApplyBulkRole={handleBulkRoleChange}
            onClearSelection={() => setSelectedIds(new Set())}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRoleChange={handleRoleChange}
            onDeleteUser={handleDeleteUser}
          />
        </>
      )}

      {!error && tab === "audit" && (
        <AuditLogTab
          logs={auditLogs}
          total={auditTotal}
          loading={auditLoading}
          page={auditPage}
          pageSize={AUDIT_PAGE_SIZE}
          userMap={userMap}
          action={auditAction}
          resource={auditResource}
          dateFrom={auditDateFrom}
          dateTo={auditDateTo}
          onAction={(v) => updateAudit({ ax: v || null }, { resetPage: true })}
          onResource={(v) => updateAudit({ ar: v || null }, { resetPage: true })}
          onDateFrom={(v) => updateAudit({ af: v || null }, { resetPage: true })}
          onDateTo={(v) => updateAudit({ at: v || null }, { resetPage: true })}
          onReset={resetAuditFilters}
          onPageChange={(next) =>
            updateAudit({ ap: next <= 1 ? null : String(next) })
          }
        />
      )}
    </div>
  )
}
