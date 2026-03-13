# Backup & Recovery Strategy

## Overview

Bible School LMS uses Supabase (managed PostgreSQL) as its primary database and Supabase Storage for file uploads. This document describes the backup strategy, recovery procedures, and data protection measures.

---

## 1. Database Backups (Supabase PostgreSQL)

### Automatic Backups (Supabase-Managed)

Supabase provides automatic daily backups:

| Plan    | Backup Frequency | Retention | Point-in-Time Recovery (PITR) |
|---------|-----------------|-----------|-------------------------------|
| Free    | Daily           | 7 days    | No                            |
| Pro     | Daily           | 7 days    | Optional (up to 7 days)       |
| Team    | Daily           | 14 days   | Included (up to 14 days)      |

**No action required** — these backups run automatically via the Supabase dashboard under **Settings > Database > Backups**.

### Manual Backups (Recommended Before Major Changes)

Before running Alembic migrations or making destructive changes, create a manual backup:

```bash
# Export full database using pg_dump
pg_dump "$DATABASE_URL" --no-owner --no-privileges -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Export as plain SQL (human-readable)
pg_dump "$DATABASE_URL" --no-owner --no-privileges -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### Pre-Migration Checklist

1. Create a manual backup (see above)
2. Test the migration on a staging database first
3. Run `alembic upgrade head` on production
4. Verify data integrity after migration
5. Keep the backup for at least 30 days

---

## 2. File Storage Backups (Supabase Storage)

Uploaded files (images, PDFs, documents) are stored in the Supabase Storage `files` bucket.

### Supabase Storage Redundancy

Supabase Storage uses S3-compatible object storage with built-in redundancy. Files are not included in database backups.

### Manual File Backup (Optional)

For critical file preservation, periodically sync the storage bucket:

```bash
# Using Supabase CLI (if installed)
supabase storage ls files --project-ref <project-ref>

# Or use the Supabase Management API to list and download files
```

For full file backup automation, consider using the Supabase Storage API to enumerate and download all files to a separate backup location.

---

## 3. Recovery Procedures

### Scenario A: Restore from Supabase Automatic Backup

1. Go to **Supabase Dashboard > Settings > Database > Backups**
2. Select the desired backup point
3. Click **Restore**
4. Supabase handles the restore process (downtime: typically < 5 minutes)

### Scenario B: Restore from Manual Backup

```bash
# Restore from custom-format dump
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" backup_20260312_120000.dump

# Restore from SQL file
psql "$DATABASE_URL" < backup_20260312_120000.sql
```

### Scenario C: Rollback a Bad Migration

```bash
cd backend
# Check current migration state
alembic current

# Downgrade one step
alembic downgrade -1

# Or downgrade to a specific revision
alembic downgrade <revision_id>
```

---

## 4. Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | ≤ 24 hours | Daily automatic backups; < 1 min with PITR on Pro plan |
| **RTO** (Recovery Time Objective) | ≤ 30 minutes | Supabase restore + Vercel redeploy |

---

## 5. Data Protection Measures

### Already Implemented

- **Alembic migrations** — versioned, reversible schema changes
- **Audit log** — all critical operations are logged with user, action, timestamp, and IP
- **Input sanitization** — dangerous HTML stripped from user inputs
- **Security headers** — HSTS, CSP, X-Frame-Options, etc.
- **Rate limiting** — per-endpoint limits on sensitive operations (auth: 10/min, uploads: 20/min)
- **JWT authentication** — tokens validated on every API request
- **RBAC** — role-based access control (admin, teacher, student)
- **Data export** — users can export all their data (GDPR compliance)
- **Account deletion** — users can delete their account and associated data

### Recommended for Production

- [ ] Enable PITR (Point-in-Time Recovery) on Supabase Pro plan
- [ ] Set up automated off-site backups (e.g., weekly pg_dump to a separate cloud storage)
- [ ] Configure Supabase database alerts for high CPU / storage usage
- [ ] Set up uptime monitoring (e.g., UptimeRobot on the /health endpoint)

---

## 6. Backup Schedule Summary

| What | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| Database | Supabase auto-backup | Daily | 7-14 days (plan-dependent) |
| Database | Manual pg_dump | Before migrations + weekly | 30 days |
| Files | Supabase Storage redundancy | Continuous | Indefinite |
| Files | Manual sync (optional) | Monthly | 90 days |
| Audit logs | In-database | Continuous | Indefinite |
