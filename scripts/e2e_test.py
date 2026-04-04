"""
End-to-end smoke tests for the Bible School production API.

Tests only public (no-auth) endpoints to verify the live API is responding.
"""

import sys
import os
import time
import requests

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "https://biblie-school-backend.vercel.app"
API = f"{BASE_URL}/api/v1"
TIMEOUT = 15

passed = 0
failed = 0
errors: list[str] = []


def test(name: str, method: str, url: str, *, expect_status: int | set[int] = 200):
    """Run a single HTTP test and report pass/fail."""
    global passed, failed
    expected = {expect_status} if isinstance(expect_status, int) else expect_status
    try:
        t0 = time.time()
        resp = requests.request(method, url, timeout=TIMEOUT)
        elapsed_ms = (time.time() - t0) * 1000
        if resp.status_code in expected:
            passed += 1
            print(f"  PASS  {name}  ({resp.status_code}, {elapsed_ms:.0f}ms)")
            return resp
        else:
            failed += 1
            detail = resp.text[:200] if resp.text else "(empty body)"
            msg = f"  FAIL  {name}  expected {expected} got {resp.status_code}  {detail}"
            print(msg)
            errors.append(msg)
            return resp
    except requests.RequestException as exc:
        failed += 1
        msg = f"  ERR   {name}  {exc}"
        print(msg)
        errors.append(msg)
        return None


def main():
    global passed, failed

    print(f"\n{'='*60}")
    print(f"  Bible School API — E2E Smoke Tests")
    print(f"  Target: {BASE_URL}")
    print(f"{'='*60}\n")

    # ── 1. Health check ──────────────────────────────────────────
    print("[Health]")
    resp = test("GET /health/db", "GET", f"{API}/health/db")
    if resp and resp.status_code == 200:
        data = resp.json()
        print(f"         db status={data.get('status')}, "
              f"profiles_table={data.get('profiles_table_exists')}")
    print()

    # ── 2. Courses ───────────────────────────────────────────────
    print("[Courses]")
    resp = test("GET /courses (list)", "GET", f"{API}/courses")

    course_id = None
    courses = []
    if resp and resp.status_code == 200:
        courses = resp.json()
        print(f"         returned {len(courses)} course(s)")
        if courses:
            course_id = courses[0].get("id")
            print(f"         first course: id={course_id}  "
                  f"title={courses[0].get('title', '?')!r}")

    if course_id:
        test("GET /courses/{id} (detail)", "GET", f"{API}/courses/{course_id}")
    else:
        print("  SKIP  GET /courses/{id} — no courses available")
    print()

    # ── 3. Announcements ─────────────────────────────────────────
    print("[Announcements]")
    resp = test("GET /announcements", "GET", f"{API}/announcements")
    if resp and resp.status_code == 200:
        items = resp.json()
        print(f"         returned {len(items)} announcement(s)")
    print()

    # ── 4. Cohorts ───────────────────────────────────────────────
    print("[Cohorts]")
    if course_id:
        resp = test("GET /cohorts/course/{id}", "GET",
                     f"{API}/cohorts/course/{course_id}")
        if resp and resp.status_code == 200:
            items = resp.json()
            print(f"         returned {len(items)} cohort(s) for course {course_id}")
    else:
        print("  SKIP  GET /cohorts/course/{id} — no courses available")
    print()

    # ── 5. Reviews ───────────────────────────────────────────────
    print("[Reviews]")
    if course_id:
        resp = test("GET /reviews/course/{id}", "GET",
                     f"{API}/reviews/course/{course_id}")
        if resp and resp.status_code == 200:
            items = resp.json()
            print(f"         returned {len(items)} review(s) for course {course_id}")
    else:
        print("  SKIP  GET /reviews/course/{id} — no courses available")
    print()

    # ── 6. Prerequisites ─────────────────────────────────────────
    print("[Prerequisites]")
    if course_id:
        resp = test("GET /prerequisites/course/{id}", "GET",
                     f"{API}/prerequisites/course/{course_id}",
                     expect_status={200, 503})
        if resp and resp.status_code == 200:
            items = resp.json()
            print(f"         returned {len(items)} prerequisite(s)")
        elif resp and resp.status_code == 503:
            print("  WARN  503 — course_prerequisites table may not "
                  "exist in production DB (migration needed?)")
    else:
        print("  SKIP  GET /prerequisites/course/{id} — no courses available")
    print()

    # ── 7. Certificate verification (expect valid=false) ─────────
    print("[Certificate Verification]")
    resp = test("GET /certificates/verify/{num} (fake)", "GET",
                f"{API}/certificates/verify/CERT-000000000000",
                expect_status=200)
    if resp and resp.status_code == 200:
        data = resp.json()
        valid = data.get("valid")
        print(f"         valid={valid} (expected False)")
        if valid is not False:
            failed += 1
            msg = "  FAIL  certificate verify returned valid=True for fake number"
            print(msg)
            errors.append(msg)
        else:
            passed += 1
            print("  PASS  certificate verify correctly returned valid=False")
    print()

    # ── 8. Extra: test course detail with bogus ID (expect 404) ──
    print("[Edge Cases]")
    test("GET /courses/{bogus} (404)", "GET",
         f"{API}/courses/00000000-0000-0000-0000-000000000000",
         expect_status=404)
    print()

    # ── 9. Module detail (if we have a course with modules) ──────
    if courses and courses[0].get("modules"):
        modules = courses[0]["modules"]
        if modules:
            mod_id = modules[0].get("id")
            print("[Modules]")
            test("GET /courses/{id}/modules/{mid}", "GET",
                 f"{API}/courses/{course_id}/modules/{mod_id}")
            print()

    # ── Summary ──────────────────────────────────────────────────
    total = passed + failed
    print(f"{'='*60}")
    print(f"  RESULTS: {passed}/{total} passed, {failed}/{total} failed")
    if errors:
        print(f"\n  Failures:")
        for e in errors:
            print(f"    {e}")
    print(f"{'='*60}\n")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
