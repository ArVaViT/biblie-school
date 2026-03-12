# Bible School LMS

A modern Learning Management System for Bible study courses. Built with React and FastAPI, featuring role-based access control, course authoring tools, student progress tracking, and a full admin dashboard.

**Live Demo:** [biblie-school-frontend.vercel.app](https://biblie-school-frontend.vercel.app)

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Tech Stack

| Layer      | Technologies                                            |
|------------|---------------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui    |
| Editor     | TipTap (rich text), DOMPurify (sanitization)            |
| Validation | Zod (forms), Pydantic (API)                             |
| Backend    | Python, FastAPI, SQLAlchemy, Pydantic                   |
| Database   | PostgreSQL (Supabase)                                   |
| Auth       | Supabase Auth (Google OAuth + email/password)           |
| Storage    | Supabase Storage                                        |
| Deployment | Vercel (static frontend + Python serverless backend)    |

---

## Architecture

Monorepo with two independently deployable services:

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐
│    Frontend      │─────▶│   FastAPI (API)   │─────▶│   Supabase   │
│    React SPA     │      │  /api/v1/*        │      │  PostgreSQL  │
│    Vercel CDN    │      │  Vercel Python    │      │  Auth/Storage│
└─────────────────┘      └──────────────────┘      └──────────────┘
```

- `/frontend` -- React single-page application served as static files
- `/backend` -- FastAPI application running as Vercel serverless functions
- Supabase provides PostgreSQL, authentication, and file storage

---

## Features

### Role-Based Access

Three user roles with distinct capabilities:

- **Admin** -- User management, role approvals, platform-wide settings
- **Teacher** -- Course creation, module/chapter authoring, gradebook, analytics
- **Student** -- Course enrollment, progress tracking, content consumption

### Course Management

- Hierarchical content: Courses > Modules > Chapters
- Rich text editor (TipTap) for chapter content with image support
- YouTube video embeds per chapter
- File attachments via Supabase Storage

### Student Experience

- Course catalog with search and filtering
- Enrollment and progress tracking with visual progress bars
- Chapter-by-chapter navigation

### Teacher Tools

- Full CRUD for courses, modules, and chapters
- Inline course editor with real-time saves
- Gradebook for managing student grades
- Analytics dashboard with enrollment and progress metrics

### Admin Dashboard

- User management and role assignment
- Teacher approval workflow (pending teacher accounts)
- Platform oversight

### Authentication

- Google OAuth via Supabase Auth
- Email and password registration/login
- Password reset flow with email verification

### UI/UX

- Dark and light theme with system preference detection
- Responsive design for mobile, tablet, and desktop
- Lazy-loaded routes for performance (code splitting)
- Error boundaries for graceful failure handling

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.12+
- A [Supabase](https://supabase.com/) project (free tier works)

### Clone the Repository

```bash
git clone https://github.com/your-username/biblie-school.git
cd biblie-school
```

### Install Dependencies

**Frontend:**

```bash
cd frontend
npm install
```

**Backend:**

```bash
cd backend
pip install -r requirements.txt
```

### Database Setup

1. Create a new project in [Supabase](https://supabase.com/)
2. Run the SQL migrations from `backend/migrations/` in the Supabase SQL Editor
3. Create a Storage bucket named `files` in the Supabase dashboard

---

## Project Structure

```
biblie-school/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── course/          # Course cards, content display
│   │   │   ├── layout/          # Header, navigation
│   │   │   └── ui/              # shadcn/ui primitives
│   │   ├── context/             # AuthContext, ThemeContext
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/
│   │   │   └── validations/     # Zod schemas (auth, course)
│   │   ├── pages/
│   │   │   ├── Admin/           # Admin dashboard
│   │   │   ├── Auth/            # Login, Register, Password reset
│   │   │   ├── Course/          # CourseDetail, ModuleView
│   │   │   ├── Dashboard/       # Student dashboard
│   │   │   ├── Home/            # Course catalog with search
│   │   │   ├── Profile/         # Profile management
│   │   │   └── Teacher/         # Dashboard, CourseEditor, Gradebook, Analytics
│   │   ├── services/            # API service layer (auth, courses, users)
│   │   └── types/               # TypeScript type definitions
│   └── vercel.json              # SPA routing config
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dependencies.py  # Auth guards (get_current_user, require_teacher)
│   │   │   └── v1/              # Versioned route handlers
│   │   ├── core/                # Config, database, security
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   └── services/            # Business logic layer
│   ├── migrations/              # SQL migration files
│   └── vercel.json              # Python serverless config
├── docs/                        # Architecture docs and audits
└── README.md
```

---

## Environment Variables

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

> Use the Supabase **Connection Pooler** URL (port 6543) for `DATABASE_URL`, not the direct connection (port 5432).

---

## Running Locally

Start the backend and frontend in separate terminals:

**Backend** (runs on `http://localhost:8000`):

```bash
cd backend
uvicorn app.main:app --reload
```

**Frontend** (runs on `http://localhost:5173`):

```bash
cd frontend
npm run dev
```

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Endpoint                  | Description                    | Auth     |
|--------|---------------------------|--------------------------------|----------|
| POST   | `/auth/register`          | Register a new account         | Public   |
| POST   | `/auth/login`             | Login with credentials         | Public   |
| GET    | `/auth/me`                | Get current user profile       | Required |

### Courses

| Method | Endpoint                                          | Description              | Auth       |
|--------|---------------------------------------------------|--------------------------|------------|
| GET    | `/courses?search=term`                            | List courses (searchable)| Public     |
| GET    | `/courses/{id}`                                   | Course detail            | Public     |
| GET    | `/courses/{id}/modules/{mid}`                     | Module with chapters     | Public     |
| GET    | `/courses/my`                                     | Teacher's own courses    | Teacher    |
| POST   | `/courses`                                        | Create course            | Teacher    |
| PUT    | `/courses/{id}`                                   | Update course            | Teacher    |
| DELETE | `/courses/{id}`                                   | Delete course            | Teacher    |

### Modules and Chapters

| Method | Endpoint                                          | Description              | Auth       |
|--------|---------------------------------------------------|--------------------------|------------|
| POST   | `/courses/{id}/modules`                           | Create module            | Teacher    |
| PUT    | `/courses/{id}/modules/{mid}`                     | Update module            | Teacher    |
| DELETE | `/courses/{id}/modules/{mid}`                     | Delete module            | Teacher    |
| POST   | `/courses/{id}/modules/{mid}/chapters`            | Create chapter           | Teacher    |
| PUT    | `/courses/{id}/modules/{mid}/chapters/{cid}`      | Update chapter           | Teacher    |
| DELETE | `/courses/{id}/modules/{mid}/chapters/{cid}`      | Delete chapter           | Teacher    |

### Enrollment

| Method | Endpoint                             | Description              | Auth       |
|--------|--------------------------------------|--------------------------|------------|
| POST   | `/courses/{id}/enroll`               | Enroll in a course       | Required   |
| PUT    | `/courses/{id}/progress?progress=50` | Update progress          | Required   |

### Users and Files

| Method | Endpoint           | Description                | Auth       |
|--------|--------------------|----------------------------|------------|
| GET    | `/users/me/courses`| Enrolled courses           | Required   |
| PUT    | `/users/me`        | Update profile             | Required   |
| POST   | `/files/upload`    | Upload to Supabase Storage | Required   |

---

## Deployment

Both services deploy to [Vercel](https://vercel.com/):

1. Connect the repository to Vercel
2. Configure environment variables in the Vercel dashboard
3. **Backend**: Uses the `@vercel/python` runtime (Python 3.12)
4. **Frontend**: Build command `cd frontend && npm run build`, output directory `frontend/dist`

Each service has its own `vercel.json` for routing and runtime configuration.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please keep commits focused and include a clear description of the changes.

---

## License

This project is licensed under the [MIT License](LICENSE).
