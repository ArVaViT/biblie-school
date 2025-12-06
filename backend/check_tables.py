"""
Скрипт для проверки существующих таблиц в базе данных
Использование:
    python check_tables.py
"""
import sys
from sqlalchemy import create_engine, text, inspect
from app.core.config import settings

def check_tables():
    """Проверить какие таблицы существуют в базе данных"""
    
    # Получаем DATABASE_URL
    db_url = settings.DATABASE_URL
    
    # Ensure sslmode is set for Supabase
    if "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
    
    print(f"🔌 Подключаюсь к базе данных...")
    
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
        
        # Получаем список таблиц
        with engine.connect() as conn:
            print(f"✅ Подключение установлено\n")
            
            # Используем inspect для получения списка таблиц
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            if not tables:
                print("❌ В базе данных НЕТ таблиц!")
                print("\n📝 Вам нужно применить миграцию:")
                print("   1. Через скрипт: python apply_migrations.py")
                print("   2. Через Supabase SQL Editor: скопируйте содержимое migrations/001_initial_schema.sql")
                return False
            
            print(f"📋 Найдено таблиц: {len(tables)}\n")
            
            # Список обязательных таблиц
            required_tables = ['users', 'courses', 'modules', 'chapters', 'enrollments', 'files']
            
            print("Таблицы в базе данных:")
            print("-" * 50)
            missing_tables = []
            
            for table in sorted(tables):
                status = "✅" if table in required_tables else "ℹ️ "
                print(f"{status} {table}")
                
            print("-" * 50)
            
            # Проверяем наличие обязательных таблиц
            for required in required_tables:
                if required not in tables:
                    missing_tables.append(required)
            
            if missing_tables:
                print(f"\n⚠️  Отсутствуют обязательные таблицы:")
                for table in missing_tables:
                    print(f"   ❌ {table}")
                
                print(f"\n📝 Примените миграцию:")
                print(f"   python apply_migrations.py")
                return False
            else:
                print(f"\n✅ Все обязательные таблицы присутствуют!")
                
                # Проверяем структуру таблицы users
                if 'users' in tables:
                    columns = inspector.get_columns('users')
                    column_names = [col['name'] for col in columns]
                    required_columns = ['id', 'email', 'hashed_password', 'role']
                    
                    missing_columns = [col for col in required_columns if col not in column_names]
                    if missing_columns:
                        print(f"\n⚠️  В таблице 'users' отсутствуют колонки: {', '.join(missing_columns)}")
                        print(f"   Примените миграцию для обновления структуры")
                    else:
                        print(f"\n✅ Структура таблицы 'users' корректна")
                
                return True
        
    except Exception as e:
        print(f"\n❌ Ошибка при проверке таблиц:")
        print(f"   {str(e)}")
        print(f"\n💡 Проверьте:")
        print(f"   1. Правильность DATABASE_URL в .env")
        print(f"   2. Доступность базы данных")
        sys.exit(1)


if __name__ == "__main__":
    check_tables()

