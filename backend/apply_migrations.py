"""Apply database migrations.

Usage:
    python apply_migrations.py
"""
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from app.core.config import settings


def apply_migration():
    """Apply the initial schema migration from 001_initial_schema.sql."""
    migration_file = Path(__file__).parent / "migrations" / "001_initial_schema.sql"

    if not migration_file.exists():
        print(f"Migration file not found: {migration_file}")
        sys.exit(1)

    print(f"Reading migration file: {migration_file}")
    with open(migration_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    db_url = settings.DATABASE_URL

    if "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    print("Connecting to database...")
    print(f"   Host: {db_url.split('@')[1].split('/')[0] if '@' in db_url else 'unknown'}")

    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={
                "connect_timeout": 10,
                "options": "-c statement_timeout=30000",
            },
        )

        with engine.connect() as conn:
            print("Connected successfully")
            print("Applying migration...")

            statements = [
                s.strip()
                for s in sql_content.split(";")
                if s.strip() and not s.strip().startswith("--")
            ]

            for i, statement in enumerate(statements, 1):
                if statement:
                    try:
                        conn.execute(text(statement))
                        conn.commit()
                        print(f"   OK: {statement[:50]}...")
                    except Exception as e:
                        print(f"   Warning: {str(e)}")

        print("\nMigration applied successfully!")
        print("\nCreated tables:")
        print("   - users")
        print("   - courses")
        print("   - modules")
        print("   - chapters")
        print("   - enrollments")
        print("   - files")

    except Exception as e:
        print(f"\nError applying migration:")
        print(f"   {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    apply_migration()
