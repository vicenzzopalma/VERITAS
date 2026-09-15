@echo off
title Iniciar Veritas + Cloudflare Tunnel
echo ======================================================
echo   INICIANDO VERITAS (BACKEND + FRONTEND + CLOUDFLARE)
echo ======================================================

cd /d "%~dp0"
echo [1/3] Iniciando aplicacoes com PM2...
call npx pm2 start ecosystem.config.js

echo [2/3] Verificando servicos...
timeout /t 3 /nobreak >nul

echo [3/3] Iniciando Cloudflare Tunnel...
echo.
echo Link publico sera gerado abaixo:
echo ------------------------------------------------------
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:6001
pause
