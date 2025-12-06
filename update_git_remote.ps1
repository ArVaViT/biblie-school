# Скрипт для обновления Git remote после переименования репозитория

Write-Host "=== Обновление Git remote для biblie-school ===" -ForegroundColor Green

# Проверяем текущий remote
Write-Host "`nТекущие remotes:" -ForegroundColor Yellow
git remote -v

# Запрашиваем новый URL репозитория
Write-Host "`nВведите URL вашего репозитория на GitHub:" -ForegroundColor Cyan
Write-Host "Пример: https://github.com/ваш-username/biblie-school.git" -ForegroundColor Gray
$newUrl = Read-Host "URL"

if ($newUrl) {
    # Удаляем старый remote (если есть)
    $oldRemote = git remote | Select-Object -First 1
    if ($oldRemote) {
        Write-Host "`nУдаляю старый remote: $oldRemote" -ForegroundColor Yellow
        git remote remove $oldRemote
    }
    
    # Добавляем новый remote
    Write-Host "`nДобавляю новый remote: origin -> $newUrl" -ForegroundColor Yellow
    git remote add origin $newUrl
    
    # Проверяем новый remote
    Write-Host "`nНовые remotes:" -ForegroundColor Green
    git remote -v
    
    # Делаем fetch для синхронизации
    Write-Host "`nСинхронизирую с удаленным репозиторием..." -ForegroundColor Yellow
    git fetch origin
    
    # Проверяем статус
    Write-Host "`nТекущий статус:" -ForegroundColor Yellow
    git status
    
    Write-Host "`n=== Готово! ===" -ForegroundColor Green
    Write-Host "Теперь можно сделать:" -ForegroundColor Cyan
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m 'Initial commit: Bible School platform'" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
} else {
    Write-Host "`nURL не введен. Выход." -ForegroundColor Red
}

