#!/usr/bin/env node
/* HomeLab-Agent – verbindet einen PC über das Heimnetz (WLAN/LAN) mit dem App-Dashboard.
   Läuft auf jedem Rechner als kleiner HTTP-Dienst, komplett ohne npm-Abhängigkeiten.

   Start:      node agent.js
   Endpunkte:  GET  /ping         – Lebenszeichen (ohne Token, für die Erkennung)
               GET  /status       – Rechner-Infos + welche Apps laufen (Token nötig)
               POST /start/<id>   – App aus apps.json starten (Token nötig)
               POST /stop/<id>    – gestartete App stoppen (Token nötig)

   Sicherheit: nur im eigenen Heimnetz betreiben, niemals Port-Weiterleitung ins
   Internet! Gestartet wird ausschließlich, was in apps.json steht (Whitelist).   */

"use strict";

const http = require("node:http");
const { spawn, exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");

const VERSION = "1.0";
const BASIS = __dirname;

/* ---------- Konfiguration laden ---------- */

function ladeJson(datei, pflicht) {
  const pfad = path.join(BASIS, datei);
  if (!fs.existsSync(pfad)) {
    if (pflicht) {
      console.error(`FEHLER: ${datei} fehlt. Vorlage ${datei.replace(".json", ".example.json")} kopieren und anpassen.`);
      process.exit(1);
    }
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(pfad, "utf8"));
  } catch (e) {
    console.error(`FEHLER: ${datei} ist kein gültiges JSON: ${e.message}`);
    process.exit(1);
  }
}

const konfig = ladeJson("config.json", true);
if (!konfig.token || konfig.token === "BITTE-AENDERN") {
  console.error("FEHLER: In config.json muss ein eigenes, geheimes token gesetzt werden.");
  process.exit(1);
}
const PORT = konfig.port || 9800;
const apps = ladeJson("apps.json", true); // Whitelist: nur diese Apps sind steuerbar

/* ---------- Laufende Prozesse ---------- */

const prozesse = new Map(); // appId -> pid (nur von diesem Agent gestartete)

function pidLebt(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}

function portOffen(port) {
  return new Promise(resolve => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const fertig = ok => { s.destroy(); resolve(ok); };
    s.once("connect", () => fertig(true));
    s.once("error", () => fertig(false));
    s.setTimeout(1500, () => fertig(false));
  });
}

async function appLaeuft(app) {
  const pid = prozesse.get(app.id);
  if (pid && pidLebt(pid)) return { laeuft: true, pid, quelle: "agent" };
  if (app.port && await portOffen(app.port)) return { laeuft: true, pid: null, quelle: "port" };
  return { laeuft: false, pid: null };
}

function starteApp(app) {
  if (!app.cmd) throw new Error("kein Startkommando (cmd) in apps.json hinterlegt");
  const kind = spawn(app.cmd, {
    shell: true,
    cwd: app.cwd || BASIS,
    detached: process.platform !== "win32",
    stdio: "ignore",
    windowsHide: true,
  });
  kind.unref();
  prozesse.set(app.id, kind.pid);
  console.log(`[start] ${app.id} (PID ${kind.pid}): ${app.cmd}`);
  return kind.pid;
}

function stoppeApp(app) {
  const pid = prozesse.get(app.id);
  if (!pid || !pidLebt(pid)) {
    prozesse.delete(app.id);
    throw new Error("App wurde nicht von diesem Agent gestartet (oder läuft nicht mehr) – bitte am Rechner beenden");
  }
  if (process.platform === "win32") {
    exec(`taskkill /pid ${pid} /t /f`);
  } else {
    try { process.kill(-pid, "SIGTERM"); } catch (e) { process.kill(pid, "SIGTERM"); }
  }
  prozesse.delete(app.id);
  console.log(`[stopp] ${app.id} (PID ${pid})`);
}

/* ---------- HTTP-Server ---------- */

function antworte(res, code, daten) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  res.end(JSON.stringify(daten));
}

function tokenOk(req) {
  return req.headers.authorization === `Bearer ${konfig.token}`;
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "OPTIONS") return antworte(res, 204, {});

  if (req.method === "GET" && url === "/ping") {
    return antworte(res, 200, { ok: true, agent: "homelab", version: VERSION, name: konfig.name || os.hostname() });
  }

  if (!tokenOk(req)) return antworte(res, 401, { fehler: "Token fehlt oder falsch (Authorization: Bearer <token>)" });

  if (req.method === "GET" && url === "/status") {
    const liste = [];
    for (const app of apps) {
      const s = await appLaeuft(app);
      liste.push({ id: app.id, name: app.name || app.id, port: app.port || null, url: app.url || null, laeuft: s.laeuft, pid: s.pid });
    }
    return antworte(res, 200, {
      ok: true,
      name: konfig.name || os.hostname(),
      hostname: os.hostname(),
      plattform: `${os.type()} ${os.release()}`,
      betriebszeitMin: Math.round(os.uptime() / 60),
      apps: liste,
    });
  }

  const start = url.match(/^\/start\/([\w-]+)$/);
  const stopp = url.match(/^\/stop\/([\w-]+)$/);
  if (req.method === "POST" && (start || stopp)) {
    const id = (start || stopp)[1];
    const app = apps.find(a => a.id === id);
    if (!app) return antworte(res, 404, { fehler: `App '${id}' steht nicht in apps.json (Whitelist)` });
    try {
      if (start) {
        const s = await appLaeuft(app);
        if (s.laeuft) return antworte(res, 200, { ok: true, hinweis: "läuft bereits", pid: s.pid });
        const pid = starteApp(app);
        return antworte(res, 200, { ok: true, pid });
      }
      stoppeApp(app);
      return antworte(res, 200, { ok: true });
    } catch (e) {
      return antworte(res, 500, { fehler: e.message });
    }
  }

  antworte(res, 404, { fehler: "unbekannter Endpunkt (kenne /ping /status /start/<id> /stop/<id>)" });
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log(`HomeLab-Agent v${VERSION} auf ${konfig.name || os.hostname()}`);
  console.log(`Erreichbar im Heimnetz unter: ${ips.map(ip => `http://${ip}:${PORT}`).join("  ") || `http://localhost:${PORT}`}`);
  console.log(`${apps.length} App(s) in der Whitelist: ${apps.map(a => a.id).join(", ")}`);
  console.log("Diese Adresse im Dashboard beim jeweiligen Rechner als Agent-Adresse eintragen.");
});
