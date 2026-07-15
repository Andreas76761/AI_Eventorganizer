@echo off
rem HomeLab-Agent per Doppelklick starten (Windows).
rem Voraussetzung: Node.js ist installiert (https://nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)
node homelab-agent.js
pause
