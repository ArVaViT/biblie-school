# System Audit — Bible School LMS

**Date:** 2026-02-26  
**Auditor:** CTO Agent Swarm (Architect, Security, DevOps, PM)  
**Verdict:** The MVP works. The architecture does not.

---

## Executive Summary

The platform is functional for demo purposes. However, it has **critical security vulnerabilities**, a **split-brain data access pattern**, **stale migration files**, and **zero observability**. Before any feature work, the foundation must be hardened.

**Risk Level: HIGH** — A moderately skilled attacker could escalate to admin using browser DevTools within minutes.

---

## 1. Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│   FastAPI (API)   │────▶│   Supabase   │
│  React SPA   │     │  Vercel Python   │     │  PostgreSQL  │
│   Vercel     │     │  /api/v1/*       │     │  Auth/Storage│
└──────┬───────┘     └──────────────────┘     └──────────────┘
       │                                              ▲
       └──────────────────────────────────────────────┘
              Direct Supabase calls (anon key)
```

**The Problem:** The frontend talks to BOTH the backend API AND Supabase directly. This creates two ungoverned data paths and makes security enforcement impossible to centralize.

---

## 2. Bottlenecks & Technical Debt

### 2.1 Split-Brain Data Access (CRITICAL)

| What goes through the API | What goes direct to Supabase |
|---------------------------|------------------------------|
| Course/Module/Chapter CRUD | Auth (login, register, OAuth) |
| Enrollment, progress update | Profile reads/updates |
| File upload (backend) | Chapter progress (read/write/delete) |
| Teacher course listing | Course analytics |
| | All admin operations (users, roles) |
| | Gradebook (grades CRUD) |
| | Storage (avatars, images, materials) |

**Impact:** Business logic is scattered. RLS policies become the only line of defense for ~60% of operations. The backend's auth checks and validation are bypassed entirely for admin, analytics, and grading operations.

### 2.2 Migration Drift (HIGH)

The migration file (`001_initial_schema.sql`) defines a `users` table with `hashed_password`. The app uses a `profiles` table (created by Supabase trigger) with UUID PKs, no password. Additional tables (`chapter_progress`, `student_grades`) and columns (`status`, `video_url`, `avatar_url`) exist in production but have no migration.

**Impact:** No reproducible database setup. If the Supabase project is recreated, the schema cannot be restored from code.

### 2.3 N+1 Query Problem (MEDIUM)

- `get_courses()` — no eager loading of modules; `CourseResponse` includes modules → N+1
- `get_course()` — no eager loading of modules+chapters → N+1
- `get_user_courses()` — no eager loading of course data → N+1

**Impact:** Performance degrades linearly with data growth. At 50 courses with 10 modules each, the course list fires ~500 queries.

### 2.4 No Error Boundaries (MEDIUM)

No React `ErrorBoundary` anywhere. An uncaught error in any component crashes the entire app with a white screen.

### 2.5 No Code Splitting (LOW)

All routes load upfront. TipTap alone adds ~200KB to the bundle. Only teachers use it, but all users pay the cost.

---

## 3. Dead Code & Stale Artifacts

| File | Issue |
|------|-------|
| `backend/test_api.ps1` | Calls non-existent `/api/v1/auth/register` |
| `backend/create_test_user.py` | Calls non-existent `/api/v1/auth/test-register` |
| `backend/test_register.py` | Stale test script |
| `backend/quick_test.py` | Stale test script |
| `backend/do_real_test.py` | Stale test script |
| `backend/generate_hash.py` | Utility with no runtime use |
| `backend/generate_jwt_secret.py` | Utility with no runtime use |
| `backend/check_tables.py` | Checks for `users` table (wrong — app uses `profiles`) |
| `backend/apply_migrations.py` | Applies `001_initial_schema.sql` which is out of sync |
| `backend/migrations/001_initial_schema.sql` | Defines `users` table; app uses `profiles` |
| `backend/app/schemas/auth.py` | `Token`, `TokenData` schemas — never used |
| `backend/app/models/file.py` | `File` model — not used by any route effectively |

---

## 4. Dependency Issues

### Backend
- `supabase` package used in `file_service.py` but **not in `requirements.txt`** — production ImportError
- `PyJWT` is pre-CVE-2024-53861 — upgrade to ≥2.10.1
- `fastapi` 0.104.1 is outdated (current: 0.115.x)
- `bcrypt` used in test scripts but not in requirements

### Frontend
- Bundle is 977KB (gzip: 291KB) — above Vite's 500KB warning
- No lazy loading for heavy routes (CourseEditor with TipTap)

---

## 5. Complexity Traps

### Trap 1: "We'll add RLS later"
RLS was partially added via SQL dashboard but is not tracked in code. Some tables have policies, others don't. The migration says nothing about RLS. This is a ticking time bomb.

### Trap 2: "Direct Supabase is faster"
Using the Supabase client directly from the frontend was convenient for the MVP. Now it means business logic (analytics aggregation, role validation, progress calculation) lives in React components instead of a centralized service layer.

### Trap 3: "The backend handles auth"
The backend validates JWTs and checks roles for its own routes — but 60% of data mutations bypass the backend entirely. The backend's `require_teacher` check is meaningless for operations that go direct to Supabase.

---

## 6. What Works Well

| Area | Assessment |
|------|------------|
| **Auth flow** | Supabase Auth + JWT is solid. Login, register, OAuth, password reset all work. |
| **UI/UX** | Clean Tailwind design, dark mode, responsive layout, role-based navigation. |
| **TypeScript** | Strong typing throughout frontend with Zod validation on forms. |
| **API structure** | FastAPI routes are well-organized with clear CRUD patterns. |
| **Deployment** | Vercel deployment works reliably for both services. |
| **Feature completeness** | For an MVP: courses, modules, chapters, enrollment, progress, gradebook, analytics, admin panel — all functional. |

---

## 7. Verdict

The codebase demonstrates solid product thinking and good UI craft. The feature set is impressive for an MVP. However, the architecture has fundamental security flaws that must be addressed before any public launch. The priority is clear:

1. **Fix security** (RLS, role escalation, data access patterns)
2. **Consolidate data access** (route everything through the API)
3. **Clean up technical debt** (migrations, dead code, N+1 queries)
4. **Add observability** (error tracking, monitoring, logging)

Only then should new features be considered.
