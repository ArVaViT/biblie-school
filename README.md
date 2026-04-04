# Bible School LMS

A modern Learning Management System for Bible study courses. Built with React and FastAPI, featuring role-based access control, course authoring tools, student progress tracking, quizzes, assignments, certificates, cohorts, and admin tooling.

**Live demo:** [biblie-school-frontend.vercel.app](https://biblie-school-frontend.vercel.app)

---

## Table of contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Documentation and content](#documentation-and-content)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Testing](#testing)
- [CI/CD](#cicd)
- [API reference](#api-reference)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Tech stack

| Layer      | Technologies |
|------------|--------------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Editor     | TipTap (rich text), DOMPurify (sanitization) |
| Validation | Zod (forms), Pydantic (API) |
| Backend    | Python, FastAPI, SQLAlchemy, Pydantic |
| Database   | PostgreSQL (Supabase) |
| Auth       | Supabase Auth (Google OAuth + email/password) |
| Storage    | Supabase Storage |
| Deployment | Vercel (static frontend + Python serverless backend) |

---

## Architecture

Monorepo with two independently deployable services:

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐
│    Frontend     │─────▶│   FastAPI (API)   │─────▶│   Supabase   │
│    React SPA    │      │  /api/v1/*        │      │  PostgreSQL  │
│    Vercel CDN   │      │  Vercel Python    │      │  Auth/Storage│
└─────────────────┘      └──────────────────┘      └──────────────┘
```

- `frontend/` — React single-page application served as static files
- `backend/` — FastAPI application running as Vercel serverless functions
- Supabase provides PostgreSQL, authentication, and file storage

---

## Features

### Role-based access

Three user roles with distinct capabilities:

- **Admin** — User management, role approvals, platform-wide settings, audit visibility
- **Teacher** — Course creation, module/chapter authoring, blocks, quizzes, assignments, gradebook, analytics, cohorts, calendar events, certificates
- **Student** — Course enrollment, progress tracking, content consumption, submissions, reviews

### Course management

- Hierarchical content: courses → modules → chapters
- Structured chapter **blocks** (rich content units) with reordering
- Rich text editor (TipTap) with image support
- YouTube embeds per chapter
- File attachments via Supabase Storage
- Course prerequisites, announcements, and cloning

### Student experience

- Course catalog with search
- Enrollment, cohorts, calendar (deadlines and course events)
- Chapter navigation, quizzes, assignments
- Certificates and grades

### Teacher tools

- Full CRUD for courses, modules, chapters, blocks, quizzes, and assignments
- Inline editors (course, module, chapter)
- Gradebook, calculated grades, configurable weights
- Analytics, student progress, cohort management
- Certificate approval workflow

### Authentication

- Google OAuth via Supabase Auth
- Email and password registration and login
- Password reset flow
- API session via `GET /api/v1/auth/me` (JWT)

### UI/UX

- Dark and light theme with system preference detection
- Responsive layout
- Lazy-loaded routes (code splitting)
- Error boundaries

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.12+ (see CI for tested versions)
- A [Supabase](https://supabase.com/) project (free tier works)

### Clone the repository

```bash
git clone https://github.com/<your-org>/biblie-school.git
cd biblie-school
```

### Install dependencies

**Frontend**

```bash
cd frontend
npm install
```

**Backend**

```bash
cd backend
pip install -r requirements.txt
```

### Database setup

1. Create a project in [Supabase](https://supabase.com/).
2. Copy `backend/alembic.ini.example` to `backend/alembic.ini` (local only; the file is gitignored).
3. Set `DATABASE_URL` (and other variables from `backend/.env.example`), then from `backend/` run:

   ```bash
   alembic upgrade head
   ```

4. Create a Storage bucket named `files` in the Supabase dashboard (or match `SUPABASE_STORAGE_BUCKET`).

---

## Project structure

```
biblie-school/
├── frontend/
│   ├── src/
│   │   ├── components/       # UI, course, editor, quiz, assignment, layout, …
│   │   ├── context/          # AuthContext, ThemeContext
│   │   ├── hooks/
│   │   ├── lib/              # utils, validations, Supabase client
│   │   ├── pages/
│   │   │   ├── Admin/        # AdminDashboard
│   │   │   ├── Auth/         # Login, Register, OAuth callback, password flows
│   │   │   ├── Calendar/     # CalendarPage
│   │   │   ├── Certificates/ # CertificatesPage
│   │   │   ├── Course/       # CourseDetail, ModuleView, ChapterView
│   │   │   ├── Dashboard/    # Student dashboard
│   │   │   ├── Home/         # Catalog
│   │   │   ├── Profile/      # ProfilePage
│   │   │   ├── Teacher/      # Editor, gradebook, analytics, student progress, …
│   │   │   └── NotFound.tsx
│   │   ├── services/         # API and auth helpers
│   │   ├── test/             # Vitest setup
│   │   └── types/
│   └── vercel.json           # SPA routing
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dependencies.py   # Auth guards (get_current_user, require_teacher, …)
│   │   │   └── v1/               # Versioned routers (see API reference)
│   │   ├── core/             # Config, database, logging, security, sanitization
│   │   ├── middleware/       # Rate limiting, security headers
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic
│   ├── alembic/              # Alembic migrations
│   ├── alembic.ini.example   # Template; copy to alembic.ini locally
│   ├── tests/                # Pytest suite
│   └── vercel.json
├── docs/                     # See “Documentation and content”
├── scripts/                  # Optional tooling (e.g. course seeding via API)
└── README.md
```

---

## Documentation and content

| Path | Purpose |
|------|---------|
| `docs/backup-strategy.md` | **Project documentation** — backup and recovery (English). |
| `docs/scholarly-analysis-acts.md` | **Course/reference content** — scholarly material (Russian). Not app developer docs. |
| `docs/course-framework-acts.md` | **Course design content** — curriculum framework (Russian). Not app developer docs. |

Whether to keep long-form course materials in this repository is a product decision: they are valuable as course IP but increase repo size and noise for contributors who only work on code. Alternatives include a separate content repository or private storage linked from the LMS.

---

## Environment variables

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Backend (`backend/.env`)

```env
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_KEY=<your-supabase-service-role-key>
SUPABASE_STORAGE_BUCKET=files
DATABASE_URL=<your-supabase-connection-pooler-url>
JWT_SECRET_KEY=<your-jwt-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=43200
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Use the Supabase **connection pooler** URL (port `6543`) for `DATABASE_URL` in serverless environments, unless you intentionally use the direct connection (port `5432`).

---

## Running locally

Use two terminals.

**Backend** (`http://localhost:8000`):

```bash
cd backend
uvicorn app.main:app --reload
```

**Frontend** (`http://localhost:5173`):

```bash
cd frontend
npm run dev
```

---

## Testing

**Backend (pytest)**

```bash
cd backend
python -m pytest tests/ -v
```

**Frontend (Vitest)**

```bash
cd frontend
npm run test:run
```

---

## CI/CD

GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Purpose |
|----------|---------|
| `backend-ci.yml` | On changes under `backend/`: install CI dependencies, Ruff lint, compile checks, import check, **pytest** with coverage. |
| `frontend-ci.yml` | On changes under `frontend/`: `npm ci`, ESLint, TypeScript (`tsc --noEmit`), production **build**, **Vitest** (`npm run test:run`). |
| `pr-check.yml` | On pull requests: PR size hint, scan changed files for TODO/FIXME/HACK, block accidental secret/env filenames. |

Workflows use placeholder Supabase-related env values where a real project is not required.

---

## API reference

JSON API routes are mounted at **`/api/v1`**. The app also exposes **`GET /`**, **`GET /health`**, and no-op routes for common static icon paths used by the hosting stack.

There are **95** HTTP operations under `/api/v1`, grouped into **19** OpenAPI tag modules (each table below lists paths relative to `/api/v1`).

Interactive schemas: run the backend and open **`/docs`** (Swagger UI) or **`/redoc`**.

### Summary by module

| Module | Prefix | Operations |
|--------|--------|-------------|
| Analytics | `/analytics` | 1 |
| Announcements | `/announcements` | 4 |
| Assignments | `/assignments` | 8 |
| Audit | `/audit` | 1 |
| Auth | `/auth` | 1 |
| Blocks | `/blocks` | 5 |
| Calendar | `/calendar`, `/courses/.../events` | 5 |
| Certificates | `/certificates` | 9 |
| Cohorts | `/cohorts` | 6 |
| Courses | `/courses` | 15 |
| Files | `/files` | 1 |
| Grades | `/grades` | 9 |
| Health | `/health` | 1 |
| Notifications | `/notifications` | 5 |
| Prerequisites | `/prerequisites` | 2 |
| Progress | `/progress` | 4 |
| Quizzes | `/quizzes` | 10 |
| Reviews | `/reviews` | 3 |
| Users | `/users` | 5 |
| **Total** | | **95** |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/course/{course_id}` | Course analytics (authorized) |

### Announcements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/announcements` | List announcements |
| POST | `/announcements` | Create announcement |
| PUT | `/announcements/{announcement_id}` | Update announcement |
| DELETE | `/announcements/{announcement_id}` | Delete announcement |

### Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assignments/chapter/{chapter_id}` | List assignments for chapter |
| POST | `/assignments` | Create assignment |
| PUT | `/assignments/{assignment_id}` | Update assignment |
| DELETE | `/assignments/{assignment_id}` | Delete assignment |
| POST | `/assignments/{assignment_id}/submit` | Submit assignment |
| GET | `/assignments/{assignment_id}/submissions` | List submissions (teacher) |
| GET | `/assignments/{assignment_id}/my-submissions` | Current user’s submissions |
| PUT | `/assignments/submissions/{submission_id}/grade` | Grade submission |

### Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit` | Paginated audit log (admin) |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | Current user profile (JWT) |

### Blocks (chapter content)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/blocks/chapter/{chapter_id}` | List blocks |
| POST | `/blocks/chapter/{chapter_id}` | Create block |
| PUT | `/blocks/{block_id}` | Update block |
| DELETE | `/blocks/{block_id}` | Delete block |
| PUT | `/blocks/chapter/{chapter_id}/reorder` | Reorder blocks |

### Calendar and course events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar/events` | Aggregated calendar for enrolled courses |
| POST | `/courses/{course_id}/events` | Create course event (teacher) |
| GET | `/courses/{course_id}/events` | List course events |
| PUT | `/courses/{course_id}/events/{event_id}` | Update course event |
| DELETE | `/courses/{course_id}/events/{event_id}` | Delete course event |

### Certificates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/certificates/course/{course_id}` | Request certificate |
| GET | `/certificates/course/{course_id}` | Certificate for course |
| GET | `/certificates/my` | Current user’s certificates |
| GET | `/certificates/pending` | Pending (teacher scope) |
| GET | `/certificates/admin/pending` | Pending (admin) |
| PUT | `/certificates/{cert_id}/teacher-approve` | Teacher approve |
| PUT | `/certificates/{cert_id}/admin-approve` | Admin approve |
| PUT | `/certificates/{cert_id}/reject` | Reject |
| GET | `/certificates/verify/{certificate_number}` | Public verify |

### Cohorts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cohorts/course/{course_id}` | List cohorts for course |
| POST | `/cohorts/course/{course_id}` | Create cohort |
| PUT | `/cohorts/{cohort_id}` | Update cohort |
| DELETE | `/cohorts/{cohort_id}` | Delete cohort |
| GET | `/cohorts/{cohort_id}/students` | List students in cohort |
| POST | `/cohorts/{cohort_id}/complete` | Mark cohort complete |

### Courses, modules, chapters, enrollment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses` | List courses (optional search query) |
| GET | `/courses/my` | Teacher’s courses |
| GET | `/courses/{course_id}` | Course detail |
| POST | `/courses` | Create course |
| PUT | `/courses/{course_id}` | Update course |
| DELETE | `/courses/{course_id}` | Delete course |
| POST | `/courses/{course_id}/clone` | Clone course |
| POST | `/courses/{course_id}/enroll` | Enroll |
| GET | `/courses/{course_id}/modules/{module_id}` | Module with chapters |
| POST | `/courses/{course_id}/modules` | Create module |
| PUT | `/courses/{course_id}/modules/{module_id}` | Update module |
| DELETE | `/courses/{course_id}/modules/{module_id}` | Delete module |
| POST | `/courses/{course_id}/modules/{module_id}/chapters` | Create chapter |
| PUT | `/courses/{course_id}/modules/{module_id}/chapters/{chapter_id}` | Update chapter |
| DELETE | `/courses/{course_id}/modules/{module_id}/chapters/{chapter_id}` | Delete chapter |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/files/upload` | Upload file to storage |

### Grades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grades/course/{course_id}/config` | Grading weights |
| PUT | `/grades/course/{course_id}/config` | Update weights (teacher) |
| GET | `/grades/course/{course_id}/student/{student_id}/calculated` | Calculated grade |
| GET | `/grades/course/{course_id}/summary` | Grade summary |
| GET | `/grades/course/{course_id}` | All grades for course |
| GET | `/grades/course/{course_id}/student/{student_id}` | One student grade |
| PUT | `/grades/course/{course_id}/student/{student_id}` | Upsert grade |
| GET | `/grades/my` | Current user’s grades |
| GET | `/grades/my/{course_id}` | Grade for one course |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/db` | Database connectivity check |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/{notification_id}/read` | Mark read |
| POST | `/notifications/read-all` | Mark all read |
| DELETE | `/notifications/{notification_id}` | Delete notification |

### Prerequisites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/prerequisites/course/{course_id}` | List prerequisites |
| PUT | `/prerequisites/course/{course_id}` | Replace prerequisites |

### Progress

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/progress/course/{course_id}/my-progress` | Current user progress |
| GET | `/progress/course/{course_id}/students` | Students progress (teacher) |
| PUT | `/progress/chapter/{chapter_id}/student/{student_id}/complete` | Mark chapter complete |
| PUT | `/progress/chapter/{chapter_id}/student/{student_id}/incomplete` | Mark incomplete |

### Quizzes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/quizzes/chapter/{chapter_id}` | Quiz for chapter (student view) |
| GET | `/quizzes/{quiz_id}` | Quiz detail |
| POST | `/quizzes` | Create quiz |
| PUT | `/quizzes/{quiz_id}` | Update quiz |
| DELETE | `/quizzes/{quiz_id}` | Delete quiz |
| POST | `/quizzes/{quiz_id}/submit` | Submit attempt |
| GET | `/quizzes/{quiz_id}/attempts` | List attempts (teacher) |
| GET | `/quizzes/{quiz_id}/my-attempts` | Current user attempts |
| POST | `/quizzes/{quiz_id}/extra-attempts` | Grant extra attempts |
| GET | `/quizzes/{quiz_id}/extra-attempts` | List extra attempts |

### Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reviews/course/{course_id}` | List reviews |
| POST | `/reviews/course/{course_id}` | Create review |
| DELETE | `/reviews/{review_id}` | Delete own review |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me/courses` | Enrolled courses |
| GET | `/users/me/export-data` | GDPR-style data export |
| DELETE | `/users/me` | Delete account (body `{"confirm":"DELETE"}`) |
| GET | `/users/admin/users` | List users (admin) |
| PUT | `/users/admin/users/{user_id}/role` | Set role (admin) |

---

## Deployment

Both services deploy to [Vercel](https://vercel.com/):

1. Connect the repository to Vercel (two projects, or monorepo with appropriate root directories).
2. Configure environment variables in the Vercel dashboard.
3. **Backend** — `@vercel/python` runtime; see `backend/vercel.json`.
4. **Frontend** — build command `cd frontend && npm run build`, output directory `frontend/dist`.

---

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit your changes with clear messages.
4. Push the branch (`git push origin feature/your-feature`).
5. Open a pull request.

Keep commits focused and describe the change in complete sentences.

---

## License

This project is licensed under the [MIT License](LICENSE).
