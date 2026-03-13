"""Shared test fixtures for the Bible School API backend.

Sets up an in-memory SQLite database so tests run without any external
services.  PgUUID / postgresql.JSON columns compile to generic types
automatically via SQLAlchemy 2.x dialect fallback.
"""

import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/testdb")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")

import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.api.dependencies import get_current_user
from app.models.user import User, UserRole
from app.main import app

# ---------------------------------------------------------------------------
# In-memory SQLite engine shared across the entire test session
# ---------------------------------------------------------------------------

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def _enable_fk(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


TestSessionFactory = sessionmaker(
    bind=test_engine, autocommit=False, autoflush=False
)

# Stable UUIDs so tests can reference them predictably
TEACHER_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
STUDENT_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

# ---------------------------------------------------------------------------
# Per-test table lifecycle — drop/create keeps every test fully isolated
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_tables():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


# ---------------------------------------------------------------------------
# Database session
# ---------------------------------------------------------------------------


@pytest.fixture()
def db() -> Session:
    session = TestSessionFactory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


def _make_teacher() -> User:
    return User(
        id=TEACHER_ID,
        email="teacher@example.com",
        full_name="Test Teacher",
        role=UserRole.TEACHER.value,
    )


def _make_student() -> User:
    return User(
        id=STUDENT_ID,
        email="student@example.com",
        full_name="Test Student",
        role=UserRole.STUDENT.value,
    )


@pytest.fixture()
def teacher(db: Session) -> User:
    user = _make_teacher()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def student(db: Session) -> User:
    user = _make_student()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# FastAPI TestClient — authenticated as teacher by default
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(db: Session, teacher: User) -> TestClient:
    """TestClient where every request is authenticated as the seeded teacher."""

    def _override_db():
        yield db

    def _override_user():
        return teacher

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_user

    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc

    app.dependency_overrides.clear()


@pytest.fixture()
def student_client(db: Session, teacher: User, student: User) -> TestClient:
    """TestClient authenticated as the seeded student (teacher also seeded)."""

    def _override_db():
        yield db

    def _override_user():
        return student

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_user

    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc

    app.dependency_overrides.clear()


@pytest.fixture()
def anon_client(db: Session, teacher: User) -> TestClient:
    """TestClient with NO auth override — exercises the real auth pipeline."""

    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db

    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc

    app.dependency_overrides.clear()
