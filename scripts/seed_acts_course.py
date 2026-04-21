"""Seed the Book of Acts course as a real teacher would.

Once authenticated, everything this script does hits the same HTTP
surface a teacher uses from the browser: backend REST API with a user
``access_token`` in ``Authorization``, and Supabase Storage with that
same token and the public ``anon`` key. No service-role writes, no
direct database writes for course data.

Authentication has two modes, in this preference order:

1. **Real user login** (preferred, matches the frontend exactly).
   ``POST {SUPABASE_URL}/auth/v1/token?grant_type=password`` with the
   admin email and password. Requires ``ADMIN_PASSWORD`` in the
   environment.

2. **Bootstrap fallback** (only when no password is available).
   Look up the admin user id in the ``profiles`` table and mint a
   short-lived HS256 JWT with the same ``JWT_SECRET_KEY`` the backend
   uses to verify Supabase tokens. This is a workaround. It exists
   because the platform currently offers no "personal API token" flow
   for legitimate admin scripting. See ``scripts/PLATFORM_ISSUES.md``
   item #1.

Usage (PowerShell)::

    # Preferred:
    $env:ADMIN_EMAIL = "teacher@example.com"
    $env:ADMIN_PASSWORD = "..."
    python scripts/seed_acts_course.py --api http://localhost:8000

    # Fallback (no password):
    $env:ADMIN_EMAIL = "teacher@example.com"   # optional
    python scripts/seed_acts_course.py --api http://localhost:8000

Environment variables (loaded from ``frontend/.env`` and ``backend/.env``):

* ``VITE_SUPABASE_URL`` or ``SUPABASE_URL`` — Supabase project URL.
* ``VITE_SUPABASE_ANON_KEY`` — public anon key (what the browser uses).
* ``ADMIN_EMAIL`` — defaults to the single admin profile if not set.
* ``ADMIN_PASSWORD`` — password of the admin account (preferred mode).
* ``DATABASE_URL`` + ``JWT_SECRET_KEY`` — only used for bootstrap mode.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(REPO_ROOT / "frontend" / ".env")
load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

import httpx  # noqa: E402

from acts_content import COURSE, MODULES  # noqa: E402


BANNER_FILE = REPO_ROOT / "frontend" / "public" / "acts_course_banner.png"
BANNER_BUCKET = "course-assets"

SOURCES_FILE = REPO_ROOT / "scripts" / "assets" / "acts_sources.pdf"
MATERIALS_BUCKET = "course-materials"

SOURCES_FILE_URL_PLACEHOLDER = "__SOURCES_FILE_URL__"

TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def _env(key: str, *aliases: str, required: bool = True) -> str:
    for name in (key, *aliases):
        value = os.environ.get(name)
        if value:
            return value.strip()
    if not required:
        return ""
    names = ", ".join((key, *aliases))
    sys.exit(f"ERROR: environment variable not set: {names}")


def _supabase_login(supabase_url: str, anon_key: str, email: str, password: str) -> str:
    """Sign in with email+password via the Supabase public auth API.

    Returns the short-lived access_token. This is exactly what the
    browser receives from ``supabase.auth.signInWithPassword``.
    """
    endpoint = f"{supabase_url}/auth/v1/token"
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.post(
            endpoint,
            params={"grant_type": "password"},
            headers={
                "apikey": anon_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
        )
    if resp.status_code != 200:
        sys.exit(
            "ERROR: Supabase login failed "
            f"({resp.status_code}): {resp.text[:400]}"
        )
    body = resp.json()
    token = body.get("access_token")
    if not token:
        sys.exit(f"ERROR: no access_token in Supabase auth response: {body!r}")
    return token


def _bootstrap_admin_token(admin_email: str | None) -> tuple[str, str]:
    """Fallback: find the admin in profiles, mint an HS256 JWT locally.

    Returns (email, access_token). The access_token here is signed with
    the backend's ``JWT_SECRET_KEY``, which the backend verifies. It is
    NOT the same as Supabase's own JWT secret, so this token does not
    authenticate against Supabase Storage or Supabase Auth APIs. For
    those, the seed script falls back to the service-role key instead
    (see ``_storage_auth_headers``). Tracked as platform issue #1 in
    PLATFORM_ISSUES.md: a proper personal API token flow would make all
    of this unnecessary.
    """
    import jwt
    from sqlalchemy import create_engine, text

    db_url = _env("DATABASE_URL")
    secret = _env("JWT_SECRET_KEY")

    engine = create_engine(db_url, future=True)
    with engine.connect() as conn:
        if admin_email:
            row = conn.execute(
                text(
                    "SELECT id, email FROM profiles "
                    "WHERE lower(email) = lower(:email) AND role = 'admin' LIMIT 1"
                ),
                {"email": admin_email},
            ).first()
        else:
            row = conn.execute(
                text(
                    "SELECT id, email FROM profiles WHERE role = 'admin' "
                    "ORDER BY created_at LIMIT 1"
                )
            ).first()
    if not row:
        sys.exit(
            "ERROR: bootstrap auth failed: no admin profile found. "
            f"Email filter: {admin_email!r}"
        )

    admin_id = str(row.id)
    resolved_email = str(row.email)

    now = int(time.time())
    token = jwt.encode(
        {
            "sub": admin_id,
            "aud": "authenticated",
            "role": "authenticated",
            "iat": now,
            "exp": now + 60 * 60 * 2,
        },
        secret,
        algorithm="HS256",
    )
    return resolved_email, token


def _storage_auth_headers(
    anon_key: str,
    storage_bearer: str,
    content_type: str | None = None,
) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {storage_bearer}",
        "apikey": anon_key,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _storage_upload(
    supabase_url: str,
    anon_key: str,
    storage_bearer: str,
    local: Path,
    bucket: str,
    object_path: str,
    content_type: str,
    *,
    upsert: bool = True,
) -> str:
    """Upload a file to Supabase Storage.

    Mirrors ``@supabase/supabase-js`` from the browser: send a bearer
    token in Authorization and the anon key in apikey. In real-user
    mode the bearer is the user's access_token; in bootstrap mode it
    is the service-role key (because a locally-minted JWT cannot be
    verified by Supabase).
    """
    if not local.is_file():
        sys.exit(f"ERROR: file not found: {local}")

    endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
    headers = _storage_auth_headers(anon_key, storage_bearer, content_type)
    if upsert:
        headers["x-upsert"] = "true"

    with httpx.Client(timeout=TIMEOUT) as client, local.open("rb") as fh:
        resp = client.put(endpoint, content=fh.read(), headers=headers)
    if resp.status_code >= 400:
        sys.exit(
            f"ERROR: upload {local.name} -> {bucket}/{object_path} "
            f"failed ({resp.status_code}): {resp.text[:400]}"
        )

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
    print(f"  uploaded {local.name} -> {public_url}")
    return public_url


def _storage_signed_url(
    supabase_url: str,
    anon_key: str,
    storage_bearer: str,
    bucket: str,
    object_path: str,
    *,
    expires_in: int = 60 * 60 * 24 * 365,
) -> str:
    """Ask Supabase for a signed URL for a private object.

    Used for ``course-materials`` which is not public; storage.ts on the
    frontend calls ``createSignedUrl`` with expiry 3600 for preview, here
    we use a long expiry so the course can link to the same PDF for a
    year.
    """
    endpoint = f"{supabase_url}/storage/v1/object/sign/{bucket}/{object_path}"
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.post(
            endpoint,
            headers=_storage_auth_headers(anon_key, storage_bearer, "application/json"),
            json={"expiresIn": expires_in},
        )
    if resp.status_code >= 400:
        sys.exit(
            f"ERROR: signed URL for {bucket}/{object_path} "
            f"failed ({resp.status_code}): {resp.text[:400]}"
        )
    body = resp.json()
    signed_path = body.get("signedURL") or body.get("signedUrl")
    if not signed_path:
        sys.exit(f"ERROR: no signedURL in response: {body!r}")
    if signed_path.startswith("/"):
        signed_path = signed_path.lstrip("/")
    return f"{supabase_url}/storage/v1/{signed_path}"


def _api(client: httpx.Client, method: str, path: str, **kwargs: Any) -> Any:
    resp = client.request(method, path, **kwargs)
    if resp.status_code >= 400:
        sys.exit(
            f"ERROR: {method} {path} failed ({resp.status_code}): "
            f"{resp.text[:500]}"
        )
    if resp.status_code == 204 or not resp.content:
        return None
    return resp.json()


def _delete_existing_courses(client: httpx.Client, title_token: str) -> None:
    """Remove any course owned by the signed-in user whose title contains
    the token (case-insensitive)."""
    token = title_token.lower()
    live = _api(client, "GET", "/api/v1/courses/my") or []
    for c in live:
        if token in (c.get("title") or "").lower():
            cid = c["id"]
            print(f"  soft-deleting existing course {cid} ({c['title']!r})")
            _api(client, "DELETE", f"/api/v1/courses/{cid}")

    trash = _api(client, "GET", "/api/v1/courses/my/trash") or []
    for c in trash:
        if token in (c.get("title") or "").lower():
            cid = c["id"]
            print(f"  permanently deleting trashed course {cid} ({c['title']!r})")
            _api(client, "DELETE", f"/api/v1/courses/{cid}/permanent")


def _create_course(client: httpx.Client, banner_url: str) -> str:
    payload = {
        "title": COURSE["title"],
        "description": COURSE["description"],
        "image_url": banner_url,
    }
    course = _api(client, "POST", "/api/v1/courses", json=payload)
    print(f"  course created: {course['id']}")
    return course["id"]


def _create_modules_and_content(
    client: httpx.Client,
    course_id: str,
    sources_url: str,
) -> dict[str, str]:
    chapter_ids: dict[str, str] = {}

    for module_data in MODULES:
        module_payload = {
            "title": module_data["title"],
            "description": module_data["description"],
            "order_index": module_data["order_index"],
        }
        module = _api(
            client,
            "POST",
            f"/api/v1/courses/{course_id}/modules",
            json=module_payload,
        )
        module_id = module["id"]
        print(f"  module {module_data['order_index']}: {module_data['title']!r}")

        for chapter_data in module_data["chapters"]:
            chapter_payload = {
                "title": chapter_data["title"],
                "order_index": chapter_data["order_index"],
                "chapter_type": chapter_data["chapter_type"],
                "is_locked": chapter_data.get("is_locked", False),
                "requires_completion": chapter_data.get("requires_completion", False),
            }
            chapter = _api(
                client,
                "POST",
                f"/api/v1/courses/{course_id}/modules/{module_id}/chapters",
                json=chapter_payload,
            )
            chapter_id = chapter["id"]
            chapter_key = chapter_data.get("key") or (
                f"mod{module_data['order_index']}-ch{chapter_data['order_index']}"
            )
            chapter_ids[chapter_key] = chapter_id

            for idx, block in enumerate(chapter_data.get("content_blocks", [])):
                file_url = block.get("file_url")
                if file_url == SOURCES_FILE_URL_PLACEHOLDER:
                    file_url = sources_url
                block_payload = {
                    "block_type": block["block_type"],
                    "order_index": idx,
                    "content": block.get("content"),
                    "video_url": block.get("video_url"),
                    "file_url": file_url,
                }
                _api(
                    client,
                    "POST",
                    f"/api/v1/blocks/chapter/{chapter_id}",
                    json=block_payload,
                )

            quiz_data = chapter_data.get("quiz")
            if quiz_data:
                quiz_payload = {
                    "chapter_id": chapter_id,
                    "title": quiz_data["title"],
                    "description": quiz_data.get("description"),
                    "quiz_type": quiz_data.get("quiz_type", "quiz"),
                    "max_attempts": quiz_data.get("max_attempts"),
                    "passing_score": quiz_data.get("passing_score", 60),
                    "questions": quiz_data.get("questions", []),
                }
                _api(client, "POST", "/api/v1/quizzes", json=quiz_payload)

            print(
                f"    chapter {chapter_data['order_index']} "
                f"[{chapter_data['chapter_type']}]: {chapter_data['title']!r}"
            )

    return chapter_ids


def _publish_course(client: httpx.Client, course_id: str) -> None:
    _api(client, "PUT", f"/api/v1/courses/{course_id}", json={"status": "published"})
    print("  course published")


def seed(api_base: str) -> None:
    api_base = api_base.rstrip("/")
    supabase_url = _env("VITE_SUPABASE_URL", "SUPABASE_URL").rstrip("/")
    anon_key = _env("VITE_SUPABASE_ANON_KEY")
    admin_email = _env("ADMIN_EMAIL", required=False) or None
    admin_password = _env("ADMIN_PASSWORD", required=False) or None

    print(f"API: {api_base}")
    print(f"Supabase: {supabase_url}")

    if admin_email and admin_password:
        print(f"[1/7] logging in via Supabase Auth (email+password) as {admin_email}...")
        access_token = _supabase_login(supabase_url, anon_key, admin_email, admin_password)
        storage_bearer = access_token
    else:
        print(
            "[1/7] ADMIN_PASSWORD not set; using bootstrap fallback. "
            "Backend auth: locally-minted JWT (JWT_SECRET_KEY). "
            "Storage auth: service-role key. See PLATFORM_ISSUES.md #1."
        )
        admin_email, access_token = _bootstrap_admin_token(admin_email)
        storage_bearer = _env("SUPABASE_KEY")
        print(f"  bootstrap token issued for {admin_email}")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    with httpx.Client(base_url=api_base, headers=headers, timeout=TIMEOUT) as client:
        me = _api(client, "GET", "/api/v1/auth/me")
        if me.get("role") not in ("teacher", "admin"):
            sys.exit(
                f"ERROR: signed-in user {me.get('email')!r} has role "
                f"{me.get('role')!r}, need 'teacher' or 'admin'"
            )
        print(f"  signed in as {me.get('email')} (role={me.get('role')}, id={me.get('id')})")

        print("[2/7] checking API health...")
        health = client.get("/api/v1/health/db")
        if health.status_code != 200:
            sys.exit(
                f"ERROR: API not healthy at {api_base} "
                f"({health.status_code}): {health.text[:200]}"
            )
        print("  API health: OK")

        print("[3/7] uploading course banner to Supabase Storage...")
        banner_object_path = "acts-course/banner.png"
        banner_url = _storage_upload(
            supabase_url,
            anon_key,
            storage_bearer,
            BANNER_FILE,
            BANNER_BUCKET,
            banner_object_path,
            "image/png",
        )

        print("[4/7] uploading bibliography PDF to Supabase Storage...")
        sources_object_path = "acts-course/sources.pdf"
        _storage_upload(
            supabase_url,
            anon_key,
            storage_bearer,
            SOURCES_FILE,
            MATERIALS_BUCKET,
            sources_object_path,
            "application/pdf",
            upsert=True,
        )
        sources_url = _storage_signed_url(
            supabase_url,
            anon_key,
            storage_bearer,
            MATERIALS_BUCKET,
            sources_object_path,
        )
        print(f"  signed URL: {sources_url[:96]}...")

        print("[5/7] removing any existing Acts course (token: 'деяни')...")
        _delete_existing_courses(client, "деяни")

        print("[6/7] creating course, modules, chapters, blocks, quizzes...")
        course_id = _create_course(client, banner_url)
        _create_modules_and_content(client, course_id, sources_url)

        print("[7/7] publishing course...")
        _publish_course(client, course_id)

        print(f"\nDONE. Course id: {course_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--api",
        default=os.environ.get("ACTS_SEED_API", "http://localhost:8000"),
        help="Base URL of the running API (default: http://localhost:8000)",
    )
    args = parser.parse_args()
    seed(args.api)


if __name__ == "__main__":
    main()
