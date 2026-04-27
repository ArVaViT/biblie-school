"""Smoke: same API route sequence a human would use, verified via TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient  # noqa: TC002

from tests.glossary_pocket_payload import (
    COURSE_TITLE,
    TEST_SEED_COVER_PATH,
    run_pocket_glossary,
)


def test_pocket_glossary_seed_end_to_end(client: TestClient) -> None:
    class _Http:
        def post(self, path: str, body: dict | None) -> dict:
            r = client.post(f"/api/v1{path}", json=body)
            assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
            return r.json() if r.text else {}

        def put(self, path: str, body: dict | None) -> dict:
            r = client.put(f"/api/v1{path}", json=body)
            assert r.status_code == 200, f"{r.status_code} {r.text}"
            return r.json()

    cid = run_pocket_glossary(_Http(), image_url=TEST_SEED_COVER_PATH)
    assert cid

    catalog = client.get("/api/v1/courses?limit=200")
    assert catalog.status_code == 200
    rows = catalog.json()
    assert any(c.get("id") == cid and c.get("title") == COURSE_TITLE for c in rows)

    detail = client.get(f"/api/v1/courses/{cid}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "published"
    assert detail.json()["image_url"] == TEST_SEED_COVER_PATH


def test_pocket_glossary_rejects_both_image_and_set_cover() -> None:
    class _Http:
        def post(self, path: str, body: dict | None) -> dict:
            return {}

        def put(self, path: str, body: dict | None) -> dict:
            return {}

    with pytest.raises(ValueError, match="at most one of"):
        run_pocket_glossary(_Http(), image_url="/x", set_cover=lambda c: "/y")
