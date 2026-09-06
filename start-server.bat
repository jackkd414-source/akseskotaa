@echo off
title AksesKota Server
echo.
echo   AksesKota - Server produksi lokal
echo   =================================
echo   Buka browser: http://localhost:8080
echo   Tekan Ctrl+C untuk berhenti.
echo.
echo   Butuh Node.js 18+ (https://nodejs.org)
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js tidak ditemukan!
    echo   Install dari https://nodejs.org lalu jalankan lagi.
    pause
    exit /b 1
)

start "" http://localhost:8080
node "%~dp0server.js"
