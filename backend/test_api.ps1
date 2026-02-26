# Script for testing registration via API
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$email = "test_user_$timestamp@example.com"
$body = @{
    email = $email
    password = "testpass123"
    full_name = "Test User API"
} | ConvertTo-Json

Write-Host "=========================================="
Write-Host "Testing registration"
Write-Host "=========================================="
Write-Host "URL: https://biblie-school-backend.vercel.app/api/v1/auth/register"
Write-Host "Email: $email"
Write-Host "Name: Test User API"
Write-Host "=========================================="
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "https://biblie-school-backend.vercel.app/api/v1/auth/register" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -Headers @{"Origin"="https://biblie-school-frontend.vercel.app"} `
        -ErrorAction Stop

    Write-Host "SUCCESS! User registered:" -ForegroundColor Green
    Write-Host "   ID: $($response.user.id)"
    Write-Host "   Email: $($response.user.email)"
    Write-Host "   Name: $($response.user.full_name)"
    Write-Host "   Token: $($response.access_token.Substring(0, 20))..."
    Write-Host ""
    Write-Host "Full response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10

    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath "test_register_result.json" -Encoding UTF8
    Write-Host ""
    Write-Host "Result saved to test_register_result.json" -ForegroundColor Yellow

} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Status code: $($_.Exception.Response.StatusCode.value__)"
}
