"""Seed the Book of Acts course via the production HTTP API.

This script exercises the teacher/admin REST endpoints exactly as the
frontend does, so running it also validates that the API surface is
wired correctly end-to-end. No direct database writes.

Usage::

    python scripts/seed_acts_course.py <admin_email> [--api http://localhost:8000]

The script:

* signs a short-lived JWT using ``JWT_SECRET_KEY`` from ``backend/.env``
  (same secret the backend uses to verify Supabase tokens), so no
  password is required;
* uploads the course banner to Supabase Storage (bucket ``course-assets``)
  using ``SUPABASE_KEY`` (service-role);
* deletes any existing course owned by the admin with the same title;
* re-creates course, modules, chapters, chapter blocks, and quizzes
  through the public API;
* publishes the course.
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

load_dotenv(REPO_ROOT / "backend" / ".env")

import httpx  # noqa: E402
import jwt  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from acts_content import COURSE, MODULES  # noqa: E402


BANNER_FILE = REPO_ROOT / "frontend" / "public" / "acts_course_banner.png"
BANNER_BUCKET = "course-assets"
BANNER_OBJECT_PATH = "acts-course/banner.png"

SOURCES_FILE = REPO_ROOT / "scripts" / "assets" / "acts_sources.pdf"
MATERIALS_BUCKET = "course-materials"
SOURCES_OBJECT_PATH = "acts-course/sources.pdf"

SOURCES_FILE_URL_PLACEHOLDER = "__SOURCES_FILE_URL__"

TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def _env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        sys.exit(f"ERROR: environment variable {key} is not set")
    return value.strip()


def _mint_admin_jwt(admin_id: str, secret: str) -> str:
    now = int(time.time())
    payload = {
        "sub": admin_id,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now,
        "exp": now + 60 * 60 * 2,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _find_admin_id(email: str) -> str:
    engine = create_engine(_env("DATABASE_URL"), future=True)
    with Session(engine) as db:
        row = db.execute(
            text("SELECT id FROM profiles WHERE email = :email AND role = 'admin'"),
            {"email": email},
        ).one_or_none()
    if not row:
        sys.exit(f"ERROR: no admin user found with email {email!r}")
    return str(row.id)


def _upload_to_storage(
    local: Path,
    bucket: str,
    object_path: str,
    content_type: str,
) -> str:
    """Upload a file to Supabase Storage and return its public URL."""
    if not local.is_file():
        sys.exit(f"ERROR: file not found: {local}")

    supabase_url = _env("SUPABASE_URL")
    service_key = _env("SUPABASE_KEY")

    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"

    with httpx.Client(timeout=TIMEOUT) as client, local.open("rb") as fh:
        resp = client.put(endpoint, content=fh.read(), headers=headers)
    if resp.status_code >= 400:
        sys.exit(f"ERROR: upload {local.name} failed ({resp.status_code}): {resp.text}")

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
    print(f"  uploaded {local.name} -> {public_url}")
    return public_url


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
    """Remove any course owned by admin whose title contains the token
    (case-insensitive). Uses permanent delete so repeats stay clean."""
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
    """Create all modules -> chapters -> blocks/quizzes. Return {chapter_key: id}."""
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
            chapter_key = chapter_data.get("key") or f"mod{module_data['order_index']}-ch{chapter_data['order_index']}"
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
                _api(client, "POST", f"/api/v1/blocks/chapter/{chapter_id}", json=block_payload)

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
                f"    chapter {chapter_data['order_index']} [{chapter_data['chapter_type']}]: "
                f"{chapter_data['title']!r}"
            )

    return chapter_ids


def _publish_course(client: httpx.Client, course_id: str) -> None:
    _api(client, "PUT", f"/api/v1/courses/{course_id}", json={"status": "published"})
    print(f"  course published")


def seed(admin_email: str, api_base: str) -> None:
    api_base = api_base.rstrip("/")
    admin_id = _find_admin_id(admin_email)
    token = _mint_admin_jwt(admin_id, _env("JWT_SECRET_KEY"))

    print(f"API: {api_base}")
    print(f"Admin: {admin_email} ({admin_id})")

    print("[1/6] uploading banner...")
    banner_url = _upload_to_storage(BANNER_FILE, BANNER_BUCKET, BANNER_OBJECT_PATH, "image/png")

    print("[2/6] uploading sources file...")
    sources_url = _upload_to_storage(
        SOURCES_FILE, MATERIALS_BUCKET, SOURCES_OBJECT_PATH, "application/pdf"
    )

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    with httpx.Client(base_url=api_base, headers=headers, timeout=TIMEOUT) as client:
        health = client.get("/api/v1/health/db")
        if health.status_code != 200:
            sys.exit(f"ERROR: API not healthy at {api_base} ({health.status_code}): {health.text[:200]}")
        print("[3/6] API health: OK")

        print("[4/6] removing any existing Acts course (by token 'деяни')...")
        _delete_existing_courses(client, "деяни")

        print("[5/6] creating course and content...")
        course_id = _create_course(client, banner_url)
        _create_modules_and_content(client, course_id, sources_url)

        print("[6/6] publishing course...")
        _publish_course(client, course_id)

        print(f"\nDONE. Course id: {course_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("admin_email", help="Email of the admin user (course owner)")
    parser.add_argument(
        "--api",
        default=os.environ.get("ACTS_SEED_API", "http://localhost:8000"),
        help="Base URL of the running API (default: http://localhost:8000)",
    )
    args = parser.parse_args()
    seed(args.admin_email, args.api)


if __name__ == "__main__":
    main()
