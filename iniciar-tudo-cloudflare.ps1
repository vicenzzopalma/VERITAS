Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  INICIANDO VERITAS (BACKEND + FRONTEND + CLOUDFLARE)  " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

Set-Location "d:\whaticket"

Write-Host "`n[1/3] Iniciando backend e frontend com PM2..." -ForegroundColor Yellow
npx pm2 start ecosystem.config.js

Start-Sleep -Seconds 3

Write-Host "`n[2/3] Status das portas locais:" -ForegroundColor Yellow
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(6001, 6002) } | Format-Table LocalAddress, LocalPort, OwningProcess

Write-Host "`n[3/3] Iniciando Cloudflare Tunnel na porta 6001 (Frontend + API + WebSocket)..." -ForegroundColor Green
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:6001
