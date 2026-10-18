@echo off
chcp 65001 >nul
cd /d "%~dp0"
title KI-Projekte suchen (Claude, Codex, Perplexity, Lovable, OpenAI, Gemini)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js fehlt. Bitte von https://nodejs.org installieren.
  start https://nodejs.org
  pause
  exit /b 1
)
node ki-projekte-suchen.js
echo.
echo Fertig. Die Datei  ki-projekte-*.txt  an Claude schicken.
pause
