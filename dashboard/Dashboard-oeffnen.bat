@echo off
chcp 65001 >nul
cd /d "%~dp0"
title HomeLab App-Dashboard
echo ============================================================
echo   HomeLab App-Dashboard wird gestartet ...
echo ============================================================
echo.

rem Node bevorzugt (bringt keinen Extra-Server mit, nutzt eingebauten),
rem sonst Python. Eines von beidem genuegt.
where node >nul 2>nul
if not errorlevel 1 goto mitnode
where python >nul 2>nul
if not errorlevel 1 goto mitpython
echo Weder Node.js noch Python gefunden. Bitte Node.js installieren:
start https://nodejs.org
pause
exit /b 1

:mitnode
echo Dashboard laeuft auf:  http://localhost:8950
start "" http://localhost:8950
node -e "const h=require('http'),f=require('fs'),p=require('path');const M={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};h.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=p.join(process.cwd(),u);if(!fp.startsWith(process.cwd())||!f.existsSync(fp)){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':M[p.extname(fp).toLowerCase()]||'application/octet-stream'});r.end(f.readFileSync(fp));}).listen(8950,()=>console.log('Bereit. Zum Beenden dieses Fenster schliessen.'));"
goto ende

:mitpython
echo Dashboard laeuft auf:  http://localhost:8950
start "" http://localhost:8950
python -m http.server 8950
goto ende

:ende
pause
