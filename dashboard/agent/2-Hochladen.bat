@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GitHub-Upload - Schritt 2: Hochladen
where node >nul 2>nul || (echo Node.js fehlt: https://nodejs.org & pause & exit /b 1)
where git >nul 2>nul || (echo Git fehlt: https://git-scm.com & start https://git-scm.com & pause & exit /b 1)
if not exist github-token.txt if "%GITHUB_TOKEN%"=="" (
  echo FEHLER: Kein GitHub-Token gefunden.
  echo Lege die Datei  github-token.txt  an und schreibe dein Token hinein
  echo (siehe ANLEITUNG.txt), dann diese Datei erneut ausfuehren.
  pause
  exit /b 1
)
echo Es werden PRIVATE Repos angelegt und der Code hochgeladen.
choice /C JN /M "Jetzt hochladen (J=Ja, N=Abbrechen)"
if errorlevel 2 exit /b 0
node github-upload.js run
pause
