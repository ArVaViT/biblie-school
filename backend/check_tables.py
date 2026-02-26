"""Check which tables exist in the database.

Usage:
    python check_tables.py
"""
import sys
from sqlalchemy import create_engine, text, inspect
from app.core.config import settings


def check_tables():
    """Verify that all required tables exist in the database."""
    db_url = settings.DATABASE_URL

    if "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    print("Connecting to database...")

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
            print("Connected successfully\n")

            inspector = inspect(engine)
            tables = inspector.get_table_names()

            if not tables:
                print("No tables found in the database!")
                print("\nYou need to apply the migration:")
                print("   1. Via script: python apply_migrations.py")
                print("   2. Via Supabase SQL Editor: paste contents of migrations/001_initial_schema.sql")
                return False

            print(f"Found {len(tables)} table(s)\n")

            required_tables = ["users", "courses", "modules", "chapters", "enrollments", "files"]

            print("Tables in database:")
            print("-" * 50)

            for table in sorted(tables):
                status = "[required]" if table in required_tables else "[extra]"
                print(f"  {status} {table}")

            print("-" * 50)

            missing_tables = [t for t in required_tables if t not in tables]

            if missing_tables:
                print(f"\nMissing required tables:")
                for table in missing_tables:
                    print(f"   - {table}")
                print(f"\nApply migration: python apply_migrations.py")
                return False
            else:
                print(f"\nAll required tables present!")

                if "users" in tables:
                    columns = inspector.get_columns("users")
                    column_names = [col["name"] for col in columns]
                    required_columns = ["id", "email", "hashed_password", "role"]

                    missing_columns = [col for col in required_columns if col not in column_names]
                    if missing_columns:
                        print(f"\nTable 'users' is missing columns: {', '.join(missing_columns)}")
                        print("   Apply the migration to update the schema")
                    else:
                        print(f"Table 'users' schema is correct")

                return True

    except Exception as e:
        print(f"\nError checking tables:")
        print(f"   {str(e)}")
        print(f"\nCheck:")
        print(f"   1. DATABASE_URL in .env is correct")
        print(f"   2. Database is accessible")
        sys.exit(1)


if __name__ == "__main__":
    check_tables()
