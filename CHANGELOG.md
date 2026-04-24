# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not yet follow [Semantic Versioning](https://semver.org/) but
will adopt it starting with v1.0.0.

## [Unreleased]

_Nothing yet — see the [ROADMAP](ROADMAP.md) for what's next._

## [0.1.0] - 2026-04-24

First public release as an open-source project. Everything below was built
over the preceding months and is now available under the MIT license.

### Core platform

- **Role-based access control** — admin, teacher, and student roles with
  fine-grained API and UI guards.
- **Course authoring** — courses, modules, chapters, and rich content blocks
  via a TipTap editor (text, images, YouTube embeds, callouts, audio).
- **Quiz system** — `multiple_choice`, `true_false`, `short_answer`, and
  `essay` question types with per-quiz attempt limits and teacher-granted
  extra attempts.
- **Assignments** — submission, teacher grading queue, and automatic chapter
  completion on submission.
- **Enrollment and progress** — student enrollment, chapter-level progress
  tracking, and module/course completion.
- **Certificates** — automatic generation with teacher approval flow.
- **Cohorts** — group students for batch management and analytics.
- **Announcements** — admin/teacher broadcast system with banner display.
- **Calendar** — course and cohort event management.
- **Notifications** — in-app notification bell with read/unread state.
- **Teacher tools** — gradebook, analytics dashboard, pending-answers queue
  for essay/short-answer grading.
- **Admin tools** — user management, bulk operations, CSV export, soft
  delete, course cloning, full-text search.

### Design and UX

- **Design system** — editorial aesthetic (Fraunces + Inter), OKLCH semantic
  tokens, dark/light theme, responsive down to 360px.
- **UI primitives** — shadcn/ui + Radix (AlertDialog, DropdownMenu, Popover,
  Tooltip, Sheet, Tabs, Accordion, ScrollArea, Avatar, Badge).
- **Patterns** — InlineEdit, InlineEditCover, PageHeader, EmptyState,
  ErrorState, loading skeletons, error boundaries.
- **Inline editing** — course and module headers edit in place (no modals).

### Infrastructure

- **Backend** — Python 3.12, FastAPI, SQLAlchemy 2.0 (Mapped style),
  Pydantic 2, deployed as Vercel serverless functions.
- **Frontend** — React 18, TypeScript, Vite 8, Tailwind CSS 3, deployed as
  Vercel static site.
- **Database** — PostgreSQL via Supabase with RLS on every table; migrations
  managed via Supabase CLI.
- **Auth** — Supabase Auth (Google OAuth + email/password), JWTs verified
  server-side.
- **CI/CD** — GitHub Actions (lint, typecheck, test, Postgres schema smoke,
  `npm audit`, `pip-audit`), Dependabot for weekly dependency updates.
- **Monitoring** — Datadog RUM + Session Replay (opt-in).

### Security

- RLS enabled on all tables with per-role policies.
- Server-side HTML sanitization on content create/update.
- CORS locked to known origins with regex for Vercel previews.
- Pydantic `max_length` on all user-facing string fields.
- `pip-audit` and `npm audit` in CI.
- Production API docs disabled.
- `FOR UPDATE` + `IntegrityError` handling for race conditions.

### Content

- "Deyaniya Apostolov" (Acts of the Apostles) — 4 modules, ~5 hours,
  100-question final exam + per-module quizzes.
- "Bibliya kak istoricheskiy dokument" (Bible as a Historical Document) —
  mini-course with Bible Project video chapters and module quiz.

[Unreleased]: https://github.com/ArVaViT/biblie-school/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ArVaViT/biblie-school/releases/tag/v0.1.0
