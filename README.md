# Bible School - Платформа курсов

Full-stack приложение для управления курсами с React фронтендом, FastAPI бэкендом и Supabase.

## Технологии

- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + Pydantic
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Hosting**: Vercel

## Структура проекта

```

biblie-school/
├── frontend/          # React приложение
├── backend/           # FastAPI приложение
└── vercel.json        # Конфигурация Vercel
```

## Установка и запуск

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:3000` (или порт, указанный в vite.config.ts)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend будет доступен на `http://localhost:8000`

### База данных

1. Создайте проект в Supabase
2. Выполните SQL миграции из `backend/migrations/001_initial_schema.sql` в Supabase SQL Editor
3. Создайте Storage bucket с именем `files` (или укажите другое имя в переменных окружения)

## Переменные окружения

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
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=43200
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Деплой на Vercel

1. Подключите репозиторий к Vercel
2. Настройте переменные окружения в Vercel Dashboard
3. Для backend: установите Python версию 3.11+
4. Для frontend: укажите build command `cd frontend && npm run build` и output directory `frontend/dist`

## API Endpoints

### Аутентификация
- `POST /api/v1/auth/register` - Регистрация
- `POST /api/v1/auth/login` - Вход
- `GET /api/v1/auth/me` - Текущий пользователь

### Курсы
- `GET /api/v1/courses` - Список курсов
- `GET /api/v1/courses/{id}` - Детали курса
- `GET /api/v1/courses/{course_id}/modules/{module_id}` - Детали модуля
- `POST /api/v1/courses/{id}/enroll` - Запись на курс

### Пользователи
- `GET /api/v1/users/me/courses` - Мои курсы

### Файлы
- `POST /api/v1/files/upload` - Загрузка файла

## Особенности

- JWT аутентификация
- Роли пользователей (admin, teacher, student)
- Динамические курсы с модулями и главами
- Загрузка файлов в Supabase Storage
- Современный UI с shadcn/ui

