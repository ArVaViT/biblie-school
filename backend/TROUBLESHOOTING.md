# Troubleshooting

## Database Tables

All required tables must exist. If they are missing, apply the migration:

### Automatic (local)
```bash
cd backend
python apply_migrations.py
```

### Manual via Supabase SQL Editor
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Your project -> **SQL Editor** -> **New Query**
3. Copy the contents of `backend/migrations/001_initial_schema.sql`
4. Paste and run

### Verify tables
```bash
python check_tables.py
```

## Problem: 500 error on registration

### Check Vercel logs
1. [Vercel Dashboard](https://vercel.com) -> your backend project
2. **Deployments** -> latest deploy -> **Functions** -> **Logs**

### Check database connection
Open: `https://your-backend.vercel.app/api/v1/health/db`

### Check DATABASE_URL

For Vercel you **must** use the Connection Pooling string:

1. [Supabase Dashboard](https://app.supabase.com) -> your project
2. **Settings** -> **Database** -> **Connection Pooling**
3. Mode: **Transaction**
4. Copy the Connection String

**Important:**
- Port must be **6543** (not 5432)
- Username: `postgres.[PROJECT-REF]`
- Append: `?sslmode=require`

Example:
```
postgresql://postgres.[REF]:[PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres?sslmode=require
```

### Update DATABASE_URL in Vercel
1. [Vercel Dashboard](https://vercel.com) -> your backend project
2. **Settings** -> **Environment Variables**
3. Update `DATABASE_URL` to the Connection Pooling string
4. Select all environments (Production, Preview, Development)
5. **Redeploy** the project

## Common Errors

- **"Wrong password"** — Incorrect username/password in DATABASE_URL
- **"Cannot assign requested address"** — Using direct URL instead of Connection Pooling
- **"relation does not exist"** — Tables not created (apply the migration)
