"""
Upload a course cover to Supabase Storage (``course-assets`` public bucket).

Must match the object layout used by the frontend: ``{courseId}/cover.{ext}``,
and the public URL shape returned by :func:`public_img_path_for_course_cover`.
Service role bypasses storage RLS — server-only; never import from client code.
"""

from __future__ import annotations

import httpx

COURSE_ASSETS_BUCKET = "course-assets"

_content_type = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


def public_img_path_for_course_cover(course_id: str, ext: str) -> str:
    """Same path pattern as ``getPublicUrl`` in ``frontend/src/services/storage.ts``."""
    e = (ext or "png").lower().lstrip(".")
    return f"/img/{COURSE_ASSETS_BUCKET}/{course_id}/cover.{e}"


def upload_course_cover_bytes(
    supabase_url: str,
    service_role_key: str,
    course_id: str,
    data: bytes,
    *,
    ext: str = "png",
) -> str:
    """
    Upload cover bytes; return a same-origin path suitable for ``courses.image_url``.

    Raises on non-2xx from Storage API.
    """
    e = ext.lower().lstrip(".")
    if e not in _content_type:
        e = "png"
    object_path = f"{course_id}/cover.{e}"
    base = supabase_url.rstrip("/")
    # Standard upload: POST /storage/v1/object/{bucketId}/{objectPath}
    url = f"{base}/storage/v1/object/{COURSE_ASSETS_BUCKET}/{object_path}"
    ct = _content_type.get(e, "image/png")
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": ct,
        "x-upsert": "true",
    }
    with httpx.Client(timeout=60.0) as client:
        r = client.post(url, content=data, headers=headers)
    if r.status_code not in (200, 201):
        raise RuntimeError(
            f"Storage upload failed {r.status_code}: {r.text[:500]}",
        )
    return public_img_path_for_course_cover(course_id, e)
