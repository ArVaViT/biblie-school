# Bible School - Course Platform

Full-stack application for managing courses with a React frontend, FastAPI backend, and Supabase.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS + Zod
- **Backend**: FastAPI + SQLAlchemy + Pydantic + bcrypt
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Hosting**: Vercel

## Live URLs

- **Frontend**: https://biblie-school-frontend.vercel.app
- **Backend API**: https://biblie-school-backend.vercel.app

## Project Structure

```
biblie-school/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # UI components (shadcn/ui + custom)
│   │   │   ├── course/        # CourseCard
│   │   │   ├── layout/        # Header
│   │   │   └── ui/            # shadcn primitives (button, card, input, label)
│   │   ├── context/           # AuthContext, ThemeContext
│   │   ├── lib/               # Utilities + Zod validation schemas
│   │   │   └── validations/   # auth.ts, course.ts
│   │   ├── pages/
│   │   │   ├── Auth/          # Login, Register
│   │   │   ├── Course/        # CourseDetail, ModuleView
│   │   │   ├── Dashboard/     # Student dashboard
│   │   │   ├── Home/          # Course catalog with search
│   │   │   ├── Profile/       # Profile editing
│   │   │   └── Teacher/       # TeacherDashboard, CourseEditor
│   │   ├── services/          # API service layer (auth, courses, users)
│   │   └── types/             # TypeScript type definitions
│   └── vercel.json            # SPA rewrites
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── api/
│   │   │   ├── dependencies.py  # Auth guards (get_current_user, require_teacher)
│   │   │   └── v1/             # Route handlers (auth, courses, users, files, health)
│   │   ├── core/              # Config, database, security (JWT + bcrypt)
│   │   ├── models/            # SQLAlchemy models (User, Course, Module, Chapter, Enrollment, File)
│   │   ├── schemas/           # Pydantic schemas (auth, course, user)
│   │   └── services/          # Business logic (auth_service, course_service, file_service)
│   ├── migrations/            # SQL migration files
│   └── vercel.json            # Python serverless config
└── README.md
```

## Setup & Running

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`

### Database

1. Create a project in Supabase
2. Run the SQL migration from `backend/migrations/001_initial_schema.sql` in the Supabase SQL Editor
3. Create a Storage bucket named `files`

## Environment Variables

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (backend/.env)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=files
DATABASE_URL=postgresql://user:password@host:6543/database?sslmode=require
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=43200
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Deploy to Vercel

1. Connect the repository to Vercel
2. Configure environment variables in Vercel Dashboard
3. Backend: uses `@vercel/python` runtime (Python 3.12)
4. Frontend: build command `cd frontend && npm run build`, output `frontend/dist`

> **Important**: Use the Supabase **Connection Pooler** URL (port 6543) for `DATABASE_URL`, not the direct connection (port 5432).

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` — Register (role: `"teacher"` | `"student"`)
- `POST /api/v1/auth/login` — Login
- `GET /api/v1/auth/me` — Current user (JWT required)

### Courses (public)
- `GET /api/v1/courses?search=term` — List courses with optional search
- `GET /api/v1/courses/{id}` — Course detail with modules
- `GET /api/v1/courses/{course_id}/modules/{module_id}` — Module with chapters

### Courses (teacher only)
- `GET /api/v1/courses/my` — Teacher's own courses
- `POST /api/v1/courses` — Create course
- `PUT /api/v1/courses/{id}` — Update course
- `DELETE /api/v1/courses/{id}` — Delete course
- `POST /api/v1/courses/{id}/modules` — Create module
- `PUT /api/v1/courses/{id}/modules/{mid}` — Update module
- `DELETE /api/v1/courses/{id}/modules/{mid}` — Delete module
- `POST /api/v1/courses/{id}/modules/{mid}/chapters` — Create chapter
- `PUT /api/v1/courses/{id}/modules/{mid}/chapters/{cid}` — Update chapter
- `DELETE /api/v1/courses/{id}/modules/{mid}/chapters/{cid}` — Delete chapter

### Enrollment
- `POST /api/v1/courses/{id}/enroll` — Enroll in course (JWT required)
- `PUT /api/v1/courses/{id}/progress?progress=50` — Update progress

### Users
- `GET /api/v1/users/me/courses` — Enrolled courses
- `PUT /api/v1/users/me` — Update profile

### Files
- `POST /api/v1/files/upload` — Upload to Supabase Storage

## Features

- JWT authentication with role-based access (teacher / student)
- **Teacher dashboard** — full CRUD for courses, modules, and chapters
- **Course editor** — inline module/chapter management with real-time saves
- **Course search** — filter courses by title or description
- **Profile management** — edit display name
- **Dark mode** — system-aware with manual toggle, persisted in localStorage
- **Progress tracking** — enrollment progress bar per course
- Zod form validation on all forms
- React Context for auth and theme state (no page reloads)
- Modern UI with shadcn/ui, Tailwind CSS, and smooth animations
- Responsive design for mobile, tablet, and desktop
- Serverless deployment on Vercel (frontend static, backend Python lambda)

## Planned Updates

- [ ] Rich text editor (Markdown or WYSIWYG) for chapter content
- [ ] Password reset flow (forgot password / email verification)
- [ ] File attachments per chapter (PDF, images)
- [ ] Student quiz/assessment system
- [ ] Course completion certificates
- [ ] Admin panel for user management
- [ ] Notifications (enrollment confirmation, new content)
- [ ] Course categories and tags
