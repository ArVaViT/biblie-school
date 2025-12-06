# Настройка Git после переименования репозитория

## Вариант 1: Автоматический (через скрипт)

Запустите скрипт:
```powershell
.\update_git_remote.ps1
```

Скрипт попросит ввести новый URL репозитория и автоматически обновит remote.

## Вариант 2: Вручную

### 1. Проверьте текущий remote:
```powershell
git remote -v
```

### 2. Удалите старый remote (если есть):
```powershell
git remote remove origin
```

### 3. Добавьте новый remote с правильным URL:
```powershell
git remote add origin https://github.com/ваш-username/biblie-school.git
```

Или если используете SSH:
```powershell
git remote add origin git@github.com:ваш-username/biblie-school.git
```

### 4. Синхронизируйте с удаленным репозиторием:
```powershell
git fetch origin
```

### 5. Проверьте статус:
```powershell
git status
```

### 6. Если нужно, переименуйте ветку в main:
```powershell
git branch -M main
```

### 7. Добавьте все изменения и сделайте коммит:
```powershell
git add .
git commit -m "Initial commit: Bible School platform with React, FastAPI, and Supabase"
```

### 8. Отправьте в репозиторий:
```powershell
git push -u origin main
```

## Если репозиторий уже существует на GitHub

Если в удаленном репозитории уже есть коммиты, может потребоваться:

```powershell
# Получить изменения
git pull origin main --allow-unrelated-histories

# Или если конфликты
git pull origin main --rebase
```

## Проверка

После настройки проверьте:
```powershell
git remote -v
git branch -a
git status
```

Все должно указывать на `biblie-school` репозиторий.

