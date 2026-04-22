# Bible School LMS

A modern Learning Management System for Bible study courses.

**Live:** [biblie-school-frontend.vercel.app](https://biblie-school-frontend.vercel.app)

---

## Stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TipTap |
| Backend     | Python, FastAPI, SQLAlchemy, Pydantic, Alembic |
| Database    | PostgreSQL (Supabase) |
| Auth        | Supabase Auth (Google OAuth + email/password) |
| Storage     | Supabase Storage |
| Deployment  | Vercel (static frontend + Python serverless backend) |

---

## Features

- **Roles:** admin, teacher, student — with fine-grained access control.
- **Authoring:** courses → modules → chapters → rich content blocks; quizzes and assignments.
- **Learning:** enrollments, progress tracking, quizzes with multiple attempts, assignment submissions, certificates.
- **Teacher tools:** gradebook, analytics, cohorts, calendar, announcements, certificate approvals.
- **UX:** dark/light theme, responsive, lazy-loaded routes, error boundaries.

---

## Local development

**Prerequisites:**
- Node.js **≥20** and npm **≥10** (pinned in `frontend/package.json` `engines`).
- Python **3.12** (matches the CI image and Vercel runtime).
- A Supabase project with the Storage buckets `avatars`, `course-assets` and
  `course-materials` (all three are written to directly from the browser via
  Supabase JS using the user's JWT, not through the backend).

### 1. Clone and install

```bash
git clone https://github.com/your-org/biblie-school.git
cd biblie-school

# Frontend — npm ci keeps your install reproducible with package-lock.json.
cd frontend && npm ci

# Backend
cd ../backend && pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env            # fill in Supabase creds
cp frontend/.env.example frontend/.env.local    # fill in VITE_* vars
cp backend/alembic.ini.example backend/alembic.ini
```

See each `.env.example` file for a description of every variable (and the
Vercel-marketplace aliases accepted for `DATABASE_URL` and `SUPABASE_KEY`).

### 3. Run migrations and start

```bash
cd backend && alembic upgrade head
uvicorn app.main:app --reload                   # API → http://localhost:8000

# In another terminal
cd frontend && npm run dev                      # SPA → http://localhost:5173
```

---

## Testing

```bash
# Backend — 383 tests, SQLite by default; CI also runs an Alembic round-trip
# against a real Postgres service container.
cd backend && python -m pytest tests/

# Frontend — Vitest + jsdom.
cd frontend && npm run test:run
```

---

## CI, dependency hygiene & deployment

- GitHub Actions run lint, typecheck, tests, Alembic migrations, `npm audit`
  and `pip-audit` on every push to `main` and every PR — see
  `.github/workflows/`.
- Dependabot (`.github/dependabot.yml`) opens grouped update PRs weekly for
  npm, pip, and GitHub Actions.
- Branch protection on `main` should require the `Frontend CI /
  lint-and-build`, `Backend CI / lint-and-test`, and `Backend CI /
  migrations-postgres` checks before merge. (Configure once via the GitHub
  repo settings — this can't be expressed in a workflow file.)
- Both apps auto-deploy to Vercel from `main`. API routes are served under
  `/api/v1/*`; OpenAPI schema is at `/docs` when running locally.
