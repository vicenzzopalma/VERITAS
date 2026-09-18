@echo off
title Veritas + WhatsApp Control - Inicializador Completo
color 0A

echo ============================================================
echo   INICIANDO ECOSSISTEMA VERITAS (COMPLETO)
echo ============================================================
echo.

cd /d "%~dp0"

echo Finalizando processos anteriores (ngrok, etc)...
taskkill /F /IM ngrok.exe >nul 2>&1

echo Limpando eventuais instancias travadas...
call ".\Gestão de celulares\node_modules\.bin\pm2.cmd" delete all >nul 2>&1

echo.
echo Iniciando todos os 5 servicos via PM2:
echo   [1] crm-celulares      (Porta 3000)
echo   [2] veritas-backend    (Porta 6002)
echo   [3] veritas-frontend   (Porta 6001 - Gateway / Reverse Proxy)
echo   [4] ngrok-tunnel       (Public Tunnel -> Porta 6001)
echo   [5] veritas-sync-agent (Sincronizador SQLite <-> CRM)
echo.

call ".\Gestão de celulares\node_modules\.bin\pm2.cmd" start ecosystem.config.js
call ".\Gestão de celulares\node_modules\.bin\pm2.cmd" save

echo.
echo ============================================================
echo   TUDO INICIADO COM SUCESSO!
echo   Link de Acesso:
echo   https://bankroll-confetti-kilogram.ngrok-free.dev/whatsapp-control
echo ============================================================
echo.
echo Esta janela fechara em 5 segundos...
ping 127.0.0.1 -n 4 >nul
exit
