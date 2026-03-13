"""One-time script to create audit_logs and notifications tables in production."""
from pathlib import Path

import psycopg2


def load_database_url() -> str:
    for raw in Path(".env.deploy").read_text(encoding="utf-8").splitlines():
        if raw.startswith("DATABASE_URL="):
            return raw.split("=", 1)[1].strip().strip('"')
    raise RuntimeError("DATABASE_URL not found in .env.deploy")


def main() -> None:
    database_url = load_database_url()
    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                action VARCHAR(50) NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                resource_id TEXT NOT NULL,
                details JSONB,
                ip_address VARCHAR(45),
                user_agent VARCHAR(500),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_type ON audit_logs(resource_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at)")
        print("audit_logs table created.")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                link VARCHAR(500),
                is_read BOOLEAN NOT NULL DEFAULT false,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id_is_read ON notifications(user_id, is_read)")
        print("notifications table created.")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
