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

**Prerequisites:** Node.js 18+, Python 3.12+, a Supabase project.

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

Copy `backend/.env.example` to `backend/.env` and fill in your Supabase credentials.
Copy `backend/alembic.ini.example` to `backend/alembic.ini`, then run migrations:

```bash
cd backend && alembic upgrade head
```

Create a Storage bucket named `files` in Supabase (or match `SUPABASE_STORAGE_BUCKET`).

---

## Testing

```bash
# Backend
cd backend && python -m pytest tests/

# Frontend
cd frontend && npm run test:run
```

---

## Deployment

Both frontend and backend auto-deploy to Vercel from `main`. CI runs on every push and pull request via GitHub Actions (`.github/workflows/`).

API is served at `/api/v1/*`. Interactive schema is available at `/docs` when running locally.
