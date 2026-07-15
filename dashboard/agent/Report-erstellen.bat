@echo off
rem HomeLab-Report per Doppelklick erstellen (Windows).
rem Voraussetzung: Node.js ist installiert (https://nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte von https://nodejs.org installieren.
  pause
  exit /b 1
)
node homelab-report.js
echo.
echo Fertig. Die Datei homelab-report-*.txt neben dieser Datei an Claude schicken.
pause
