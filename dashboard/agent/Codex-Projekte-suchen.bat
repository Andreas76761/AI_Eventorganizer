@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Codex-Projekte suchen
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js fehlt. Bitte von https://nodejs.org installieren.
  start https://nodejs.org
  pause
  exit /b 1
)
node codex-suche.js
echo.
echo Fertig. Die Datei  codex-projekte-*.txt  an Claude schicken.
pause
