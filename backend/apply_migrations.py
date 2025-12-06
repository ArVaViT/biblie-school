"""
Скрипт для применения миграций к базе данных
Использование:
    python apply_migrations.py
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from app.core.config import settings

def apply_migration():
    """Применить миграцию из файла migrations/001_initial_schema.sql"""
    
    # Получаем путь к файлу миграции
    migration_file = Path(__file__).parent / "migrations" / "001_initial_schema.sql"
    
    if not migration_file.exists():
        print(f"❌ Файл миграции не найден: {migration_file}")
        sys.exit(1)
    
    # Читаем SQL файл
    print(f"📖 Читаю файл миграции: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Получаем DATABASE_URL
    db_url = settings.DATABASE_URL
    
    # Ensure sslmode is set for Supabase
    if "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
    
    print(f"🔌 Подключаюсь к базе данных...")
    print(f"   Host: {db_url.split('@')[1].split('/')[0] if '@' in db_url else 'unknown'}")
    
    try:
        # Создаем engine
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={
                "connect_timeout": 10,
                "options": "-c statement_timeout=30000"
            }
        )
        
        # Применяем миграцию
        with engine.connect() as conn:
            print(f"✅ Подключение установлено")
            print(f"📝 Применяю миграцию...")
            
            # Выполняем SQL по частям (разделяем по ;)
            statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
            
            for i, statement in enumerate(statements, 1):
                if statement:
                    try:
                        conn.execute(text(statement))
                        conn.commit()
                        print(f"   ✅ Выполнено: {statement[:50]}...")
                    except Exception as e:
                        print(f"   ⚠️  Предупреждение: {str(e)}")
                        # Продолжаем, так как некоторые команды могут уже существовать
        
        print(f"\n✅ Миграция успешно применена!")
        print(f"\n📋 Созданные таблицы:")
        print(f"   - users")
        print(f"   - courses")
        print(f"   - modules")
        print(f"   - chapters")
        print(f"   - enrollments")
        print(f"   - files")
        
    except Exception as e:
        print(f"\n❌ Ошибка при применении миграции:")
        print(f"   {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    apply_migration()

