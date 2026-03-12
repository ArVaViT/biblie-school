# Security Protocol — Bible School LMS

**Date:** 2026-02-26  
**Classification:** Internal — CTO & CEO Only  
**Overall Grade: ~~D-~~ B+** (Post-remediation as of 2026-03-12)

---

## 1. Critical Vulnerabilities

### VULN-01: Privilege Escalation via Direct Profile Update
**Severity: CRITICAL | Exploitability: TRIVIAL**  
**Status: ✅ FIXED (2026-03-12)**

Any authenticated user could open browser DevTools and run:
```javascript
supabase.from("profiles").update({ role: "admin" }).eq("id", MY_USER_ID)
```
This would make them an administrator instantly.

**Remediation applied:**
- RLS enabled on `profiles` with `WITH CHECK` preventing self-role-change
- Role changes moved to backend API endpoint with `require_admin` dependency
- Admin operations (getAllUsers, updateUserRole) moved entirely to backend

---

### VULN-02: Self-Assigned Admin Role at Registration
**Severity: CRITICAL | Exploitability: EASY**  
**Status: ✅ FIXED (2026-03-12)**

A user could intercept the registration call and send `role: "admin"` in `user_metadata`.

**Remediation applied:**
- `handle_new_user` trigger hardened to force `'student'` for ALL role values except `'teacher'` → `'pending_teacher'`
- Passing `'admin'` in metadata now results in `'student'` role

---

### VULN-03: Chapter Progress Deletion Affects All Users
**Severity: HIGH | Exploitability: EASY**  
**Status: ✅ FIXED (2026-03-12)**

`unmarkChapterComplete` deleted by `chapter_id` without filtering by `user_id`.

**Remediation applied:**
- `.eq("user_id", session.user.id)` added to scope deletion to current user only
- RLS policy on `chapter_progress` also enforces `auth.uid() = user_id` on DELETE

---

### VULN-04: XSS via Unsanitized HTML Rendering
**Severity: HIGH | Exploitability: MEDIUM**  
**Status: ✅ FIXED (2026-03-12)**

`ModuleView.tsx` rendered chapter content via `dangerouslySetInnerHTML` without sanitization.

**Remediation applied:**
- DOMPurify sanitization added before rendering HTML content
- All `dangerouslySetInnerHTML` calls now pass through `DOMPurify.sanitize()`

---

## 2. RBAC Model

### Current Roles
| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Platform administrator | Full access to all data and operations |
| `teacher` | Approved instructor | Can create/manage own courses, view enrolled students |
| `pending_teacher` | Unapproved instructor | Student-level access until admin approves |
| `student` | Learner | Can browse courses, enroll, track progress |

### RBAC Enforcement Points

| Layer | What It Protects | Status |
|-------|------------------|--------|
| **Frontend UI** | Navigation, buttons, pages | Working (but bypassable) |
| **Backend API** | Course CRUD, enrollment | Working via `require_teacher`, `get_current_user` |
| **Supabase RLS** | Direct database access | ✅ ENABLED on ALL tables with strict policies |
| **Supabase Auth** | Session, tokens | Working |

### Backend Dependencies — ✅ IMPLEMENTED
```python
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return current_user
```
`require_admin` is now used by all admin endpoints. Rate limiting has been added to API endpoints.

---

## 3. Row Level Security (RLS) — Target State

### profiles
| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | Anyone authenticated | `auth.uid() IS NOT NULL` |
| UPDATE | Own profile only, role immutable | `auth.uid() = id AND role = OLD.role` |
| INSERT | Trigger only | No direct insert — `handle_new_user` trigger |

### courses
| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | Published or own | `status = 'published' OR created_by = auth.uid()` |
| INSERT | Teachers/admins | `role IN ('teacher', 'admin')` |
| UPDATE | Course owner or admin | `created_by = auth.uid() OR role = 'admin'` |
| DELETE | Course owner or admin | Same as UPDATE |

### modules / chapters
| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | Via course access | Course is published or user owns it |
| INSERT/UPDATE/DELETE | Course owner or admin | Validate via course.created_by |

### enrollments
| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT own | User's own | `auth.uid() = user_id` |
| SELECT (teacher) | Teacher sees their course enrollments | `course.created_by = auth.uid()` |
| INSERT | Self-enroll | `auth.uid() = user_id` |
| DELETE | Own or admin | `auth.uid() = user_id OR role = 'admin'` |

### chapter_progress
| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | Own progress | `auth.uid() = user_id` |
| SELECT (teacher) | Teacher reads all for analytics | `role IN ('teacher', 'admin')` |
| INSERT | Own only | `auth.uid() = user_id` |
| DELETE | Own only | `auth.uid() = user_id` |

### student_grades
| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT (student) | Own grades | `auth.uid() = student_id` |
| SELECT (teacher) | All grades | `role IN ('teacher', 'admin')` |
| INSERT/UPDATE/DELETE | Teachers/admins only | `role IN ('teacher', 'admin')` |

---

## 4. API Protection Checklist

| Endpoint | Auth | Role Check | Input Validation | Status |
|----------|:----:|:----------:|:----------------:|:------:|
| `GET /courses` | None | None | search param | OK |
| `GET /courses/:id` | None | None | path param | OK |
| `GET /courses/:id/modules/:id` | None | None | path params | OK |
| `POST /courses` | Bearer | Teacher | Schema validation | OK |
| `PUT /courses/:id` | Bearer | Teacher + Owner | Schema validation | OK |
| `DELETE /courses/:id` | Bearer | Teacher + Owner | path param | OK |
| `POST /courses/:id/enroll` | Bearer | Any user | path param | OK |
| `PUT /courses/:id/progress` | Bearer | Any user | query param 0-100 | OK |
| `POST /files/upload` | Bearer | Any user | ✅ 50MB limit, MIME allowlist | OK |
| `GET /users/me/courses` | Bearer | Any user | None | OK |
| `GET /auth/me` | Bearer | Any user | None | OK |

### Previously Missing Endpoints — ✅ NOW IMPLEMENTED
| Operation | Endpoint | Auth | Status |
|-----------|----------|------|:------:|
| `GET /admin/users` | Admin-only API | `require_admin` | ✅ Done |
| `PUT /admin/users/:id/role` | Admin-only API | `require_admin` | ✅ Done |
| `GET /courses/:id/grades` | Teacher API | `require_teacher` | ✅ Done |
| `PUT /courses/:id/grades/:studentId` | Teacher API | `require_teacher` | ✅ Done |
| `GET /users/me/grades` | Student API | Bearer | ✅ Done |

---

## 5. Storage Security

### Buckets
| Bucket | Public? | Size Limit | MIME Types | Policies |
|--------|:-------:|:----------:|:----------:|:--------:|
| `avatars` | Yes | 2MB | Images | NEED AUDIT |
| `course-assets` | Yes | 5MB | Images/SVG | NEED AUDIT |
| `course-materials` | No | 50MB | PDF/Doc/Audio | NEED AUDIT |

### Required Storage Policies
- **avatars:** Owner can upload/update/delete. Public read.
- **course-assets:** Course owner (teacher) can upload. Public read.
- **course-materials:** Course owner can upload. Enrolled students + owner can read. No public access.

---

## 6. Remediation Priority

| # | Vulnerability | Effort | Impact | Status |
|---|--------------|--------|--------|:------:|
| 1 | Fix profile UPDATE RLS (block role change) | 1 hour | Prevents admin takeover | ✅ FIXED |
| 2 | Harden `handle_new_user` trigger | 30 min | Prevents registration exploit | ✅ FIXED |
| 3 | Fix `unmarkChapterComplete` user scoping | 10 min | Prevents data corruption | ✅ FIXED |
| 4 | Add DOMPurify for HTML content | 30 min | Prevents XSS | ✅ FIXED |
| 5 | Move admin operations to backend API | 4 hours | Centralizes authorization | ✅ FIXED |
| 6 | Add `require_admin` dependency | 30 min | Enables admin-only endpoints | ✅ FIXED |
| 7 | Audit and complete RLS policies for all tables | 2 hours | Comprehensive data protection | ✅ FIXED |
| 8 | Add file upload validation (size/type) | 1 hour | Prevents storage abuse | ✅ FIXED |
| 9 | Move gradebook to backend API | 2 hours | Enforces teacher authorization | ✅ FIXED |
| 10 | Lock down CORS to production origins | 15 min | Prevents cross-origin abuse | ✅ FIXED |

> **All 10 remediation items completed as of 2026-03-12.** Additionally, rate limiting has been added to API endpoints.
