@echo off
chcp 65001 >nul
cd /d "%~dp0"
title HomeLab - diesen PC verbinden
echo ============================================================
echo   HomeLab - diesen PC verbinden und beschreiben
echo   (einfach ausfuehren - der Rest passiert automatisch)
echo ============================================================
echo.

rem --- Node pruefen ---
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js fehlt - es wird benoetigt. Ich oeffne die Download-Seite.
  echo Bitte die LTS-Version installieren und START.bat danach erneut ausfuehren.
  start https://nodejs.org
  pause
  exit /b 1
)

rem --- 1. Einrichtung (nur beim ersten Mal) ---
echo [1 von 4] Einrichtung
if exist config.json (
  echo   Bereits eingerichtet - uebersprungen.
) else (
  node homelab-agent.js --setup
)
echo.

rem --- 2. Autostart anbieten ---
echo [2 von 4] Autostart bei jeder Anmeldung
echo   (Fuer den Autostart START.bat als Administrator ausfuehren.)
choice /C JN /M "Autostart einrichten (J=Ja, N=Nein)"
if not errorlevel 2 node homelab-agent.js --autostart
echo.

rem --- 3. Agent starten (eigenes Fenster, bleibt offen) ---
echo [3 von 4] Agent starten
tasklist /fi "windowtitle eq HomeLab-Agent*" 2>nul | find /i "cmd.exe" >nul
if not errorlevel 1 (
  echo   Laeuft bereits.
) else (
  start "HomeLab-Agent" cmd /k node homelab-agent.js
  echo   Agent laeuft nun in einem eigenen Fenster.
  echo   Windows-Firewall beim ersten Mal fuer PRIVATE Netzwerke erlauben.
)
echo.

rem --- 4. Report fuer Claude erstellen ---
echo [4 von 4] Report erstellen
node homelab-report.js
echo.

echo ============================================================
echo   FERTIG. Dieser PC ist jetzt im Heimnetz sichtbar.
echo.
echo   - Im Dashboard (Rechner): den PC ueber Scan/Stift verbinden
echo   - Die erstellte Datei  homelab-report-*.txt  an Claude schicken
echo ============================================================
pause
