# Data Schema — Bible School LMS

**Date:** 2026-02-26  
**Version:** 2.0 (Target State)

---

## 1. Current vs Target Schema

The current schema has drifted significantly from the migration file. Tables were added via Supabase dashboard without tracked migrations. This document defines the **target schema** that must be captured in version-controlled migrations.

---

## 2. Entity Relationship Diagram

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   profiles   │──1:N─│  enrollments  │──N:1─│   courses    │
│  (users)     │      └──────────────┘      │              │
│              │                             │              │
│              │──1:N──┐                    │              │
└─────────────┘       │                    └──────┬───────┘
       │              ▼                           │
       │    ┌──────────────┐              ┌───────┴───────┐
       │    │student_grades │              │    modules     │
       │    └──────────────┘              └───────┬───────┘
       │                                          │
       │    ┌──────────────┐              ┌───────┴───────┐
       └─1:N│chapter_progress│──N:1───────│   chapters     │
            └──────────────┘              └───────────────┘
```

---

## 3. Table Definitions

### 3.1 profiles
Managed by Supabase Auth trigger. Mirrors `auth.users`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, references `auth.users(id)` ON DELETE CASCADE | Set by trigger |
| `email` | `text` | NOT NULL, UNIQUE | From auth.users |
| `full_name` | `text` | | From user_metadata |
| `avatar_url` | `text` | | Supabase Storage URL |
| `role` | `text` | NOT NULL, DEFAULT 'student', CHECK IN ('admin','teacher','pending_teacher','student') | |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | | Auto-updated by trigger |

**Indexes:** `idx_profiles_email` (email), `idx_profiles_role` (role)  
**RLS:** Enabled. See security_protocol.md.

---

### 3.2 courses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `image_url` | `text` | | Supabase Storage URL |
| `status` | `text` | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','published') | |
| `created_by` | `uuid` | NOT NULL, FK profiles(id) ON DELETE CASCADE | Teacher who created |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | | Auto-updated |

**Indexes:** `idx_courses_created_by`, `idx_courses_status`  
**RLS:** Enabled.

**Migration note:** Current schema uses `VARCHAR` id with application-generated UUIDs. Target: native `uuid` with `gen_random_uuid()`.

---

### 3.3 modules

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `course_id` | `uuid` | NOT NULL, FK courses(id) ON DELETE CASCADE | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `order_index` | `integer` | NOT NULL, DEFAULT 0 | Sort order within course |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:** `idx_modules_course_id`

---

### 3.4 chapters

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `module_id` | `uuid` | NOT NULL, FK modules(id) ON DELETE CASCADE | |
| `title` | `text` | NOT NULL | |
| `content` | `text` | | Rich HTML content (sanitize on read) |
| `video_url` | `text` | | YouTube URL |
| `order_index` | `integer` | NOT NULL, DEFAULT 0 | Sort order within module |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:** `idx_chapters_module_id`

---

### 3.5 enrollments

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | NOT NULL, FK auth.users(id) ON DELETE CASCADE | |
| `course_id` | `uuid` | NOT NULL, FK courses(id) ON DELETE CASCADE | |
| `enrolled_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `progress` | `integer` | NOT NULL, DEFAULT 0, CHECK (progress >= 0 AND progress <= 100) | |
| UNIQUE | | (user_id, course_id) | Prevent double enrollment |

**Indexes:** `idx_enrollments_user_id`, `idx_enrollments_course_id`, `idx_enrollments_user_course` (composite)

---

### 3.6 chapter_progress

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | NOT NULL, FK auth.users(id) ON DELETE CASCADE | |
| `chapter_id` | `uuid` | NOT NULL, FK chapters(id) ON DELETE CASCADE | |
| `completed_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| UNIQUE | | (user_id, chapter_id) | One completion per user per chapter |

**Indexes:** `idx_cp_user_id`, `idx_cp_chapter_id`

---

### 3.7 student_grades

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `student_id` | `uuid` | NOT NULL, FK auth.users(id) ON DELETE CASCADE | |
| `course_id` | `uuid` | NOT NULL, FK courses(id) ON DELETE CASCADE | |
| `grade` | `varchar(10)` | | Flexible: A/B/C or numeric |
| `comment` | `text` | | Teacher's note |
| `graded_by` | `uuid` | NOT NULL, FK auth.users(id) ON DELETE CASCADE | Teacher who graded |
| `graded_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| UNIQUE | | (student_id, course_id) | One grade per student per course |

---

### 3.8 files (to be reviewed)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | |
| `name` | `text` | NOT NULL | Original filename |
| `url` | `text` | NOT NULL | Storage URL |
| `file_type` | `text` | NOT NULL | MIME type |
| `course_id` | `uuid` | FK courses(id) ON DELETE SET NULL | |
| `user_id` | `uuid` | FK auth.users(id) ON DELETE SET NULL | Uploader |
| `uploaded_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Note:** This table may be redundant if we rely on Supabase Storage metadata. Evaluate during Phase 1.

---

## 4. Supabase Storage Buckets

| Bucket | Public | Max Size | Allowed MIME Types | Purpose |
|--------|:------:|:--------:|-------------------|---------|
| `avatars` | Yes | 2 MB | image/jpeg, image/png, image/webp, image/gif | Profile photos |
| `course-assets` | Yes | 5 MB | image/jpeg, image/png, image/webp, image/gif, image/svg+xml | Course covers |
| `course-materials` | No | 50 MB | application/pdf, audio/*, application/msword, .docx, .pptx, text/plain | Downloadable materials |

---

## 5. Triggers & Functions

### handle_new_user
Fires on `auth.users` INSERT. Creates a `profiles` row with sanitized role.

### custom_access_token_hook
Reads role from `profiles` and injects it into the JWT claims.

### updated_at_trigger (TO ADD)
Auto-sets `updated_at = now()` on any UPDATE to `profiles`, `courses`, `student_grades`.

---

## 6. Migration Strategy

**Current state:** 1 stale migration file that doesn't match production.

**Target:**
1. Generate a "ground truth" migration from live Supabase schema using `pg_dump --schema-only`
2. Store as `migrations/000_baseline.sql`
3. All future changes go through numbered migration files
4. Use Supabase MCP `apply_migration` for deployment
5. Never modify schema via Supabase dashboard without a corresponding migration file
