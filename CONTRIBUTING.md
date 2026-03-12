# Contributing to Bible School LMS

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Ensure CI passes: both frontend and backend checks must be green
6. Submit a pull request

## Development Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Code Standards

- **Frontend**: TypeScript strict mode. No `any` types. Use functional components.
- **Backend**: Type hints on all functions. Pydantic for validation. SQLAlchemy for ORM.
- **Commits**: Use conventional commits (feat:, fix:, chore:, docs:, security:, quality:)
- **PRs**: Keep PRs focused. One feature or fix per PR.

## Branch Strategy

- `main` — production-ready code, auto-deploys to Vercel
- Feature branches — `feature/description`
- Bug fixes — `fix/description`
