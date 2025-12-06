# Решение проблем

## Таблицы базы данных

Все необходимые таблицы должны быть созданы. Если их нет, примените миграцию:

### Автоматическое применение (локально)
```bash
cd backend
python apply_migrations.py
```

### Ручное применение через Supabase SQL Editor
1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Ваш проект → **SQL Editor** → **New Query**
3. Скопируйте содержимое `backend/migrations/001_initial_schema.sql`
4. Вставьте и выполните (Run)

### Проверка таблиц
```bash
python check_tables.py
```

## Проблема: 500 ошибка при регистрации

### Проверьте логи в Vercel
1. [Vercel Dashboard](https://vercel.com) → ваш backend проект
2. **Deployments** → последний деплой → **Functions** → **Logs**

### Проверьте подключение к БД
Откройте: `https://your-backend.vercel.app/api/v1/health/db`

### Проверьте DATABASE_URL

Для Vercel **обязательно** используйте Connection Pooling string:

1. [Supabase Dashboard](https://app.supabase.com) → ваш проект
2. **Settings** → **Database** → **Connection Pooling**
3. Режим **Transaction**
4. Скопируйте Connection String

**Важно:**
- ✅ Порт должен быть **6543** (не 5432)
- ✅ Username: `postgres.[PROJECT-REF]`
- ✅ В конце: `?pgbouncer=true`

Пример:
```
postgresql://postgres.[REF]:[PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
```

### Обновите DATABASE_URL в Vercel
1. [Vercel Dashboard](https://vercel.com) → ваш backend проект
2. **Settings** → **Environment Variables**
3. Обновите `DATABASE_URL` на Connection Pooling string
4. Выберите все окружения (Production, Preview, Development)
5. **Передеплойте** проект

## Частые ошибки

- **"Wrong password"** → Неправильный username/password в DATABASE_URL
- **"Cannot assign requested address"** → Используется прямой URL вместо Connection Pooling
- **"relation does not exist"** → Таблицы не созданы (примените миграцию)

