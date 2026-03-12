# Security Protocol — Bible School LMS

**Date:** 2026-02-26  
**Classification:** Internal — CTO & CEO Only  
**Overall Grade: D-** (Pre-remediation)

---

## 1. Critical Vulnerabilities (Fix Immediately)

### VULN-01: Privilege Escalation via Direct Profile Update
**Severity: CRITICAL | Exploitability: TRIVIAL**

Any authenticated user can open browser DevTools and run:
```javascript
supabase.from("profiles").update({ role: "admin" }).eq("id", MY_USER_ID)
```
This makes them an administrator instantly. The UI restricts this to admins, but the database does not.

**Root Cause:** `profiles` table either lacks RLS or has an overly permissive UPDATE policy.

**Fix:** RLS policy must prevent users from changing their own `role` column:
```sql
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = OLD.role);
```
Role changes must go through a backend endpoint with `require_admin` check.

---

### VULN-02: Self-Assigned Admin Role at Registration
**Severity: CRITICAL | Exploitability: EASY**

A user can intercept the registration call and send `role: "admin"` in `user_metadata`. The `handle_new_user` trigger must sanitize this.

**Current trigger (corrected in latest migration):**
```sql
CASE WHEN role = 'teacher' THEN 'pending_teacher' ELSE ... END
```

**Required hardening:**
```sql
CASE
  WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'pending_teacher'
  ELSE 'student'  -- FORCE student for ALL other values including 'admin'
END
```

---

### VULN-03: Chapter Progress Deletion Affects All Users
**Severity: HIGH | Exploitability: EASY**

`unmarkChapterComplete` in `courses.ts` deletes by `chapter_id` without filtering by `user_id`:
```typescript
.delete().eq("chapter_id", chapterId)  // Deletes ALL users' progress
```

**Fix:** Add `.eq("user_id", session.user.id)` to scope deletion.

---

### VULN-04: XSS via Unsanitized HTML Rendering
**Severity: HIGH | Exploitability: MEDIUM**

`ModuleView.tsx` renders chapter content via `dangerouslySetInnerHTML` without sanitization. A teacher (or attacker with teacher access) could inject `<script>` tags that execute in every student's browser.

**Fix:** Sanitize with DOMPurify before rendering:
```typescript
import DOMPurify from "dompurify"
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chapter.content) }} />
```

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
| **Supabase RLS** | Direct database access | PARTIALLY CONFIGURED — needs audit and hardening |
| **Supabase Auth** | Session, tokens | Working |

### Required Backend Dependencies (Missing)
```python
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return current_user
```

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
| `POST /files/upload` | Bearer | Any user | **NO file size/type check** | FIX |
| `GET /users/me/courses` | Bearer | Any user | None | OK |
| `GET /auth/me` | Bearer | Any user | None | OK |

### Missing Endpoints (Currently Direct Supabase)
| Operation | Should Be | Priority |
|-----------|-----------|----------|
| `GET /admin/users` | Admin-only API | P0 |
| `PUT /admin/users/:id/role` | Admin-only API | P0 |
| `GET /courses/:id/grades` | Teacher API | P1 |
| `PUT /courses/:id/grades/:studentId` | Teacher API | P1 |
| `GET /users/me/grades` | Student API | P2 |

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

| # | Vulnerability | Effort | Impact |
|---|--------------|--------|--------|
| 1 | Fix profile UPDATE RLS (block role change) | 1 hour | Prevents admin takeover |
| 2 | Harden `handle_new_user` trigger | 30 min | Prevents registration exploit |
| 3 | Fix `unmarkChapterComplete` user scoping | 10 min | Prevents data corruption |
| 4 | Add DOMPurify for HTML content | 30 min | Prevents XSS |
| 5 | Move admin operations to backend API | 4 hours | Centralizes authorization |
| 6 | Add `require_admin` dependency | 30 min | Enables admin-only endpoints |
| 7 | Audit and complete RLS policies for all tables | 2 hours | Comprehensive data protection |
| 8 | Add file upload validation (size/type) | 1 hour | Prevents storage abuse |
| 9 | Move gradebook to backend API | 2 hours | Enforces teacher authorization |
| 10 | Lock down CORS to production origins | 15 min | Prevents cross-origin abuse |
