# Development Roadmap — Bible School LMS

**Date:** 2026-02-26  
**Horizon:** Q1–Q4 2026  
**Principle:** Fix the foundation, then build on it.

---

## Phase 0: Emergency Security Hardening (Week 1)
**Goal:** Close critical vulnerabilities. No new features.

| # | Task | Effort | Owner |
|---|------|--------|-------|
| 0.1 | Harden `handle_new_user` trigger — force 'student' for any role except 'teacher'→'pending_teacher' | 30 min | Backend |
| 0.2 | Fix `profiles` RLS — block self-role-change via UPDATE policy | 1 hour | DB |
| 0.3 | Fix `unmarkChapterComplete` — add `user_id` filter | 10 min | Frontend |
| 0.4 | Add DOMPurify to sanitize `dangerouslySetInnerHTML` | 30 min | Frontend |
| 0.5 | Audit & complete RLS policies for all tables | 2 hours | DB |
| 0.6 | Lock CORS to production origins only | 15 min | Backend |
| 0.7 | Add `supabase` to `requirements.txt` | 5 min | Backend |

**Exit Criteria:** No CRITICAL or HIGH vulnerabilities remaining.

---

## Phase 1: Stabilization (Weeks 2–4)
**Goal:** Consolidate architecture. Clean technical debt. Zero new features.

### 1A: Centralize Data Access
| # | Task | Effort |
|---|------|--------|
| 1.1 | Move admin operations (getAllUsers, updateUserRole) to backend API behind `require_admin` | 4 hours |
| 1.2 | Move gradebook CRUD to backend API behind `require_teacher` | 3 hours |
| 1.3 | Move analytics queries to backend API | 2 hours |
| 1.4 | Keep chapter_progress on Supabase direct (RLS-protected) — acceptable pattern | — |
| 1.5 | Keep auth on Supabase direct — this is the intended pattern | — |

### 1B: Database Hygiene
| # | Task | Effort |
|---|------|--------|
| 1.6 | Generate baseline migration from live schema | 1 hour |
| 1.7 | Add CHECK constraints (role, progress, status) | 30 min |
| 1.8 | Add `updated_at` auto-trigger | 30 min |
| 1.9 | Add missing indexes (courses.status, chapter_progress, profiles.role) | 30 min |
| 1.10 | Delete stale migration `001_initial_schema.sql` | 5 min |

### 1C: Code Cleanup
| # | Task | Effort |
|---|------|--------|
| 1.11 | Delete all stale test scripts (test_api.ps1, create_test_user.py, etc.) | 15 min |
| 1.12 | Delete unused schemas (auth.py Token/TokenData) | 10 min |
| 1.13 | Fix N+1 queries with `joinedload` in get_courses, get_course, get_user_courses | 1 hour |
| 1.14 | Add file upload validation (size limit, MIME type allowlist) | 1 hour |

### 1D: Frontend Resilience
| # | Task | Effort |
|---|------|--------|
| 1.15 | Add React ErrorBoundary at route level | 1 hour |
| 1.16 | Add lazy loading for TeacherDashboard, CourseEditor, AdminDashboard | 1 hour |
| 1.17 | Add missing error states to Dashboard, TeacherDashboard, AdminDashboard | 1 hour |

**Phase 1 Exit Criteria:**
- All data mutations go through backend API (except auth & chapter_progress)
- Migration file matches live schema
- Zero stale code
- Error boundaries in place

---

## Phase 2: Core Features & Polish (Weeks 5–10)
**Goal:** Production-ready features. Polish UX.

### 2A: Enhanced Course Experience
| # | Task | Effort |
|---|------|--------|
| 2.1 | Course prerequisites / dependencies | 3 days |
| 2.2 | Certificate generation on course completion | 2 days |
| 2.3 | Student notes per chapter (personal, RLS-protected) | 2 days |
| 2.4 | Course review / rating system | 2 days |

### 2B: Communication
| # | Task | Effort |
|---|------|--------|
| 2.5 | Email notifications for enrollment (Brevo integration) | 2 days |
| 2.6 | Teacher announcements per course | 1 day |
| 2.7 | Admin system-wide announcements | 1 day |

### 2C: Assessment
| # | Task | Effort |
|---|------|--------|
| 2.8 | Quiz system (multiple choice per chapter) | 3 days |
| 2.9 | Assignment submission (file upload with teacher review) | 3 days |
| 2.10 | Automated progress based on quiz scores | 1 day |

### 2D: UX Polish
| # | Task | Effort |
|---|------|--------|
| 2.11 | Accessibility audit and fixes (ARIA, alt text, keyboard nav) | 2 days |
| 2.12 | Loading skeletons instead of spinners | 1 day |
| 2.13 | Toast notifications for success/error feedback | 1 day |
| 2.14 | Responsive improvements for mobile | 1 day |

**Phase 2 Exit Criteria:**
- Feature-complete LMS for Bible School use case
- Accessible (WCAG 2.1 AA)
- All user-facing errors handled gracefully

---

## Phase 3: Scaling & Operations (Weeks 11–16)
**Goal:** Production operations. Monitoring. Performance.

### 3A: Observability
| # | Task | Effort |
|---|------|--------|
| 3.1 | Sentry integration (frontend + backend) | 4 hours |
| 3.2 | Structured logging in backend (structlog) | 4 hours |
| 3.3 | Uptime monitoring (UptimeRobot or similar) | 1 hour |
| 3.4 | Vercel Analytics for frontend performance | 1 hour |

### 3B: CI/CD
| # | Task | Effort |
|---|------|--------|
| 3.5 | GitHub Actions: lint + typecheck on PR | 2 hours |
| 3.6 | GitHub Actions: build check for frontend | 1 hour |
| 3.7 | Preview deployments for PRs | 1 hour |

### 3C: Performance
| # | Task | Effort |
|---|------|--------|
| 3.8 | Backend response caching for course listings | 2 hours |
| 3.9 | Frontend code splitting per route | 2 hours |
| 3.10 | Image optimization (WebP, lazy loading) | 2 hours |
| 3.11 | Database query optimization with EXPLAIN ANALYZE | 2 hours |

### 3D: Scale Preparation
| # | Task | Effort |
|---|------|--------|
| 3.12 | Evaluate Supabase Pro (if approaching limits) | 1 hour |
| 3.13 | Add database connection pooling (Supabase Pooler or PgBouncer) | 2 hours |
| 3.14 | Rate limiting on API endpoints | 2 hours |
| 3.15 | Backup strategy documentation and testing | 2 hours |

**Phase 3 Exit Criteria:**
- Error tracking live and alerting
- CI/CD pipeline running on every PR
- Performance baseline established
- Documented runbook for operations

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-26 | Keep chapter_progress on Supabase direct | Low risk with proper RLS; avoids unnecessary API roundtrip for frequent toggle operations |
| 2026-02-26 | Keep auth on Supabase direct | This is the standard Supabase pattern; moving to API would break OAuth flow |
| 2026-02-26 | Move admin/gradebook to API | These are high-privilege operations that need centralized authorization |
| 2026-02-26 | Defer PWA, multilingual, quiz system to Phase 2 | Foundation first |
