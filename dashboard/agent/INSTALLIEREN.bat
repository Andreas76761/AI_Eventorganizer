@echo off
chcp 65001 >nul
cd /d "%~dp0"
title HomeLab - Installation
echo ============================================================
echo   HomeLab - Installation auf diesem PC
echo ============================================================
echo.

rem --- 1. Node.js pruefen ---
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ist noch nicht installiert - es wird benoetigt.
  echo Ich oeffne die Download-Seite. Bitte die LTS-Version installieren
  echo und diese Datei danach ERNEUT ausfuehren.
  start https://nodejs.org
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do set NODEV=%%v
echo Node.js gefunden: %NODEV%
echo.

rem --- 2. Einrichtung (fragt nach PC-Name, Port, Token) ---
echo [1 von 3] Einrichtung
node homelab-agent.js --setup
echo.

rem --- 3. Autostart anbieten ---
echo [2 von 3] Autostart bei jeder Anmeldung
echo   Hinweis: Fuer den Autostart dieses Fenster als Administrator ausfuehren.
choice /C JN /M "Autostart jetzt einrichten (J=Ja, N=Nein)"
if errorlevel 2 goto keinauto
node homelab-agent.js --autostart
:keinauto
echo.

rem --- 4. Agent starten ---
echo [3 von 3] Agent starten
choice /C JN /M "Agent jetzt starten (J=Ja, N=Nein)"
if errorlevel 2 goto ende
echo Der Agent laeuft nun in einem eigenen Fenster.
start "HomeLab-Agent" node homelab-agent.js
:ende
echo.
echo ============================================================
echo   Fertig. Naechste Schritte:
echo   - Windows-Firewall beim Start fuer PRIVATE Netzwerke erlauben
echo   - Im Dashboard: Rechner - Netzwerk-Scan - Scan starten
echo     ODER die angezeigte Adresse + Token unter Rechner - Stift eintragen
echo ============================================================
pause
