# Runs ~30 minutes; prints every 60s. Optional: .\ui-focus-timer.ps1 -Minutes 45
# Agent ritual: see .cursor/rules/ui-focus-session.mdc (does not extend Cursor API limits).
param([int]$Minutes = 30)

$end = (Get-Date).AddMinutes($Minutes)
while ((Get-Date) -lt $end) {
    $rem = [math]::Ceiling(($end - (Get-Date)).TotalSeconds)
    $m = [int][math]::Floor($rem / 60)
    $s = $rem % 60
    Write-Host ("[{0:HH:mm:ss}] UI timer: {1}m {2}s left - styles/visuals only" -f (Get-Date), $m, $s)
    Start-Sleep -Seconds 60
}
Write-Host ""
Write-Host "=== TIMER DONE - checkpoint: commit or write tail list ===" -ForegroundColor Yellow
