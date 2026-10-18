@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GitHub-Upload - Schritt 1: Projekte finden
where node >nul 2>nul || (echo Node.js fehlt: https://nodejs.org & start https://nodejs.org & pause & exit /b 1)
node github-upload.js scan
echo.
echo Jetzt  upload-plan.txt  oeffnen und Zeilen loeschen, die NICHT
echo hochgeladen werden sollen. Danach: 2-Hochladen.bat
pause
