#!/usr/bin/env node
/* ============================================================================
   HomeLab-Agent – Alles-in-einer-Datei-Installation
   ----------------------------------------------------------------------------
   Diese EINE Datei auf den PC kopieren (z. B. nach C:\homelab-agent\) und starten:

       node homelab-agent.js

   Beim ersten Start führt sie einen Einrichtungs-Assistenten aus (PC-Name,
   Port, Token) und legt config.json + apps.json neben sich an. Danach läuft
   sie als Dienst und verbindet den PC über WLAN/LAN mit dem HomeLab-Dashboard.

   Autostart (Windows):   node homelab-agent.js --autostart
   Netzwerk-Scan:         node homelab-agent.js --scan        (Netz wird erkannt)
                          node homelab-agent.js --scan 192.168.1 9800
   Selbst-Check je PC:    node homelab-agent.js --pruefe      (prüft alle Schritte)
   Einrichtung wiederholen: config.json löschen und neu starten.

   Endpunkte:  GET  /ping         – Lebenszeichen (ohne Token)
               GET  /status       – Rechner-Infos + laufende Apps (Token)
               POST /start/<id>   – App aus apps.json starten (Token)
               POST /stop/<id>    – gestartete App stoppen (Token)

   Sicherheit: nur im Heimnetz betreiben, Port niemals ins Internet weiterleiten.
   Gestartet wird ausschließlich, was in apps.json steht (Whitelist).
   ============================================================================ */

"use strict";

const http = require("node:http");
const { spawn, exec, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const crypto = require("node:crypto");
const readline = require("node:readline");

const VERSION = "1.1";
const BASIS = __dirname;
const KONFIG_PFAD = path.join(BASIS, "config.json");
const APPS_PFAD = path.join(BASIS, "apps.json");

/* ---------- Hilfen ---------- */

function ladeJson(pfad) {
  try {
    return JSON.parse(fs.readFileSync(pfad, "utf8"));
  } catch (e) {
    console.error(`FEHLER: ${path.basename(pfad)} ist kein gültiges JSON: ${e.message}`);
    process.exit(1);
  }
}

function eigeneIps() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
}

/* ---------- Einrichtungs-Assistent (läuft, wenn config.json fehlt) ---------- */

const APPS_VORLAGE = [
  {
    "_hinweis": "VORLAGE – bitte durch die Apps DIESES Rechners ersetzen. Einträge mit _hinweis ignoriert der Agent.",
    "id": "beispiel-app",
    "name": "Beispiel: statische App mit Python starten",
    "cmd": "python -m http.server 8933 --directory C:/2026/Claude/AI_Messe_Guide",
    "cwd": "C:/2026/Claude/AI_Messe_Guide",
    "port": 8933,
    "url": "http://localhost:8933"
  },
  {
    "_hinweis": "Beispiel für eine Vite/React-App im Dev-Modus. id muss zur App-ID im Dashboard passen.",
    "id": "diagramm-builder",
    "name": "Diagramm Builder (Dev-Server)",
    "cmd": "npm run dev",
    "cwd": "C:/2026/Claude/Diagramm_Builder",
    "port": 5173,
    "url": "http://localhost:5173"
  }
];

async function assistent() {
  // eigene Zeilen-Warteschlange statt rl.question: verliert keine Eingaben,
  // wenn Antworten schneller eintreffen als gefragt wird (z. B. eingefügter Text)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const zeilen = [];
  const wartende = [];
  rl.on("line", z => { const w = wartende.shift(); if (w) w(z); else zeilen.push(z); });
  const frage = (text, vorgabe) => new Promise(resolve => {
    process.stdout.write(`${text}${vorgabe ? ` [${vorgabe}]` : ""}: `);
    const nimm = z => resolve(z.trim() || vorgabe || "");
    if (zeilen.length) nimm(zeilen.shift()); else wartende.push(nimm);
  });

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  HomeLab-Agent – Einrichtung (einmalig)           ║");
  console.log("╚══════════════════════════════════════════════════╝");
  const name = await frage("Wie soll dieser PC im Dashboard heißen", os.hostname());
  const port = parseInt(await frage("Port für den Agent", "9800"), 10) || 9800;
  const tokenVorschlag = crypto.randomBytes(8).toString("hex");
  const token = await frage("Geheimes Token (Enter = Vorschlag übernehmen)", tokenVorschlag);
  rl.close();

  fs.writeFileSync(KONFIG_PFAD, JSON.stringify({ name, port, token }, null, 2));
  console.log(`\n✔ config.json angelegt (${KONFIG_PFAD})`);

  if (!fs.existsSync(APPS_PFAD)) {
    fs.writeFileSync(APPS_PFAD, JSON.stringify(APPS_VORLAGE, null, 2));
    console.log(`✔ apps.json mit Vorlage angelegt – bitte die Apps dieses Rechners eintragen!`);
  }

  console.log("\nIns Dashboard eintragen (Rechner → ✎):");
  for (const ip of eigeneIps()) console.log(`   Agent-Adresse: http://${ip}:${port}`);
  console.log(`   Agent-Token:   ${token}`);
  console.log("\nWindows-Firewall beim ersten Start für PRIVATE Netzwerke erlauben.");
  console.log("Autostart einrichten:  node homelab-agent.js --autostart\n");
}

/* ---------- Netzwerk-Scan (--scan): alle PCs mit Agent finden ---------- */

async function netzScan(argPrefix, argPort) {
  const port = parseInt(argPort, 10) || 9800;
  const prefixe = argPrefix
    ? [argPrefix.replace(/\.+$/, "")]
    : [...new Set(eigeneIps().map(ip => ip.split(".").slice(0, 3).join(".")))];
  if (!prefixe.length) { console.error("Kein Netz gefunden – Präfix angeben: node homelab-agent.js --scan 192.168.178"); process.exit(1); }

  const gefunden = [];
  for (const prefix of prefixe) {
    console.log(`Scanne ${prefix}.1–254 auf Port ${port} …`);
    const ips = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
    const BLOCK = 32;
    let geprueft = 0;
    for (let i = 0; i < ips.length; i += BLOCK) {
      await Promise.all(ips.slice(i, i + BLOCK).map(async ip => {
        try {
          const r = await fetch(`http://${ip}:${port}/ping`, { signal: AbortSignal.timeout(900) });
          const d = await r.json();
          if (d && d.agent === "homelab") gefunden.push({ name: d.name || ip, url: `http://${ip}:${port}`, version: d.version });
        } catch (e) { /* dort läuft kein Agent */ }
        geprueft++;
      }));
      process.stdout.write(`\r  ${geprueft}/254 geprüft, ${gefunden.length} Agent(s) gefunden`);
    }
    console.log("");
  }

  if (!gefunden.length) {
    console.log("\nKeine Agents gefunden. Läuft der Agent auf den anderen PCs? Firewall (private Netzwerke) erlaubt? Richtiges Netz?");
    process.exit(0);
  }
  console.log("\n╔═ Gefundene Rechner ═════════════════════════════════════╗");
  gefunden.sort((a, b) => a.url.localeCompare(b.url, "de", { numeric: true }))
    .forEach(g => console.log(`  🟢 ${g.name.padEnd(24)} ${g.url}`));
  console.log("╚═════════════════════════════════════════════════════════╝");
  console.log("\nIm Dashboard einlesen: Rechner → 📡 Netzwerk-Scan → Scan starten");
  console.log("(oder je Rechner über ✎ die Agent-Adresse von oben + dessen Token eintragen)");
  fs.writeFileSync(path.join(BASIS, "scan-ergebnis.json"), JSON.stringify(gefunden, null, 2));
  console.log(`Liste gespeichert: ${path.join(BASIS, "scan-ergebnis.json")}`);
}

/* ---------- Selbst-Check (--pruefe): alle Schritte auf DIESEM PC prüfen ---------- */

async function pruefeSchritte(argPrefix, argPort) {
  let zaehler = { ok: 0, warn: 0, fehler: 0 };
  const ok = t => { zaehler.ok++; console.log("  ✅ " + t); };
  const warn = t => { zaehler.warn++; console.log("  ⚠  " + t); };
  const schlecht = t => { zaehler.fehler++; console.log("  ❌ " + t); };

  console.log(`\n╔═ Selbst-Check: ${os.hostname()} ═${"═".repeat(Math.max(0, 40 - os.hostname().length))}╗\n`);

  // 1. Node-Version
  console.log("Schritt 1 – Node.js");
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major >= 18) ok(`Node ${process.versions.node} (ausreichend)`);
  else schlecht(`Node ${process.versions.node} ist zu alt – bitte LTS von nodejs.org installieren (mind. 18)`);

  // 2. Konfiguration
  console.log("\nSchritt 2 – Konfiguration");
  let konfig = null;
  if (!fs.existsSync(KONFIG_PFAD)) {
    schlecht("config.json fehlt – einfach `node homelab-agent.js` starten, der Assistent legt sie an");
  } else {
    try {
      konfig = JSON.parse(fs.readFileSync(KONFIG_PFAD, "utf8"));
      if (!konfig.token || konfig.token === "BITTE-AENDERN") schlecht("config.json: token fehlt oder ist noch die Vorlage");
      else ok(`config.json in Ordnung (Name: „${konfig.name || os.hostname()}", Port ${konfig.port || 9800})`);
    } catch (e) { schlecht("config.json ist kein gültiges JSON: " + e.message); }
  }
  const port = parseInt(argPort, 10) || (konfig && konfig.port) || 9800;

  // 3. App-Whitelist
  console.log("\nSchritt 3 – Apps (apps.json)");
  if (!fs.existsSync(APPS_PFAD)) {
    warn("apps.json fehlt – der Agent läuft, kann aber keine Apps starten");
  } else {
    try {
      const alle = JSON.parse(fs.readFileSync(APPS_PFAD, "utf8"));
      const echte = alle.filter(a => a && a.id && !a._hinweis);
      if (!echte.length) warn("apps.json enthält nur Vorlagen-Einträge – Apps dieses Rechners eintragen");
      else {
        ok(`${echte.length} App(s) in der Whitelist: ${echte.map(a => a.id).join(", ")}`);
        for (const a of echte) {
          if (!a.cmd) warn(`App „${a.id}": kein Startkommando (cmd)`);
          if (a.cwd && !fs.existsSync(a.cwd)) warn(`App „${a.id}": Ordner ${a.cwd} existiert nicht auf diesem PC`);
        }
      }
    } catch (e) { schlecht("apps.json ist kein gültiges JSON: " + e.message); }
  }

  // 4. Läuft der Agent?
  console.log("\nSchritt 4 – Agent läuft?");
  try {
    const r = await fetch(`http://127.0.0.1:${port}/ping`, { signal: AbortSignal.timeout(1500) });
    const d = await r.json();
    if (d && d.agent === "homelab") ok(`Agent läuft auf Port ${port} („${d.name}", v${d.version})`);
    else warn(`Auf Port ${port} antwortet etwas anderes als der HomeLab-Agent`);
  } catch (e) {
    schlecht(`Agent läuft NICHT (Port ${port}) – starten mit: node homelab-agent.js  (Autostart: --autostart)`);
  }

  // 5. Netzwerk
  console.log("\nSchritt 5 – Netzwerk (WLAN/LAN)");
  const ips = eigeneIps();
  if (!ips.length) schlecht("Keine Netzwerkadresse gefunden – ist WLAN/LAN verbunden?");
  else ok(`Im Netz erreichbar unter: ${ips.map(ip => `http://${ip}:${port}`).join("  ")}`);

  // 6. Andere Rechner sichtbar?
  console.log("\nSchritt 6 – Andere Rechner im Netz");
  const prefixe = argPrefix ? [argPrefix.replace(/\.+$/, "")] : [...new Set(ips.map(ip => ip.split(".").slice(0, 3).join(".")))];
  const gefunden = [];
  for (const prefix of prefixe) {
    const kandidaten = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
    for (let i = 0; i < kandidaten.length; i += 32) {
      await Promise.all(kandidaten.slice(i, i + 32).map(async ip => {
        try {
          const r = await fetch(`http://${ip}:${port}/ping`, { signal: AbortSignal.timeout(900) });
          const d = await r.json();
          if (d && d.agent === "homelab") gefunden.push({ ip, name: d.name || ip });
        } catch (e) { /* dort läuft nichts */ }
      }));
    }
  }
  const andere = gefunden.filter(g => !ips.includes(g.ip));
  if (andere.length) ok(`${andere.length} weitere(r) Rechner mit Agent sichtbar: ${andere.map(g => `${g.name} (${g.ip})`).join(", ")}`);
  else warn("Keine anderen Rechner mit Agent gefunden – dort Agent starten bzw. Firewall (private Netzwerke) erlauben");

  // Fazit
  console.log(`\n╚═ Ergebnis: ${zaehler.ok} ✅ · ${zaehler.warn} ⚠ · ${zaehler.fehler} ❌ – ${zaehler.fehler === 0 ? "dieser PC ist BEREIT" : "bitte ❌-Punkte beheben"} ═╝\n`);
}

/* ---------- Autostart (--autostart) ---------- */

function richteAutostartEin() {
  const eigenerPfad = path.join(BASIS, path.basename(__filename));
  if (process.platform === "win32") {
    try {
      execSync(`schtasks /Create /F /SC ONLOGON /TN "HomeLab-Agent" /TR "\\"${process.execPath}\\" \\"${eigenerPfad}\\""`, { stdio: "inherit" });
      console.log("✔ Autostart eingerichtet (Aufgabenplanung, Aufgabe \"HomeLab-Agent\", bei Anmeldung).");
      console.log("  Entfernen mit:  schtasks /Delete /TN \"HomeLab-Agent\" /F");
    } catch (e) {
      console.error("Autostart fehlgeschlagen – Eingabeaufforderung als Administrator ausführen und erneut versuchen.");
    }
  } else {
    console.log("Linux/macOS: systemd-Unit oder Autostart-Eintrag anlegen, z. B.:");
    console.log(`  ExecStart=${process.execPath} ${eigenerPfad}`);
  }
}

/* ---------- Agent (Hauptteil) ---------- */

function starteAgent() {
  const konfig = ladeJson(KONFIG_PFAD);
  if (!konfig.token) { console.error("FEHLER: token fehlt in config.json"); process.exit(1); }
  const PORT = konfig.port || 9800;
  const apps = fs.existsSync(APPS_PFAD) ? ladeJson(APPS_PFAD) : [];
  const echteApps = apps.filter(a => a && a.id && !a._hinweis); // _hinweis-Einträge sind nur Vorlagen

  const prozesse = new Map(); // appId -> pid

  const pidLebt = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };

  const portOffen = port => new Promise(resolve => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const fertig = ok => { s.destroy(); resolve(ok); };
    s.once("connect", () => fertig(true));
    s.once("error", () => fertig(false));
    s.setTimeout(1500, () => fertig(false));
  });

  async function appLaeuft(app) {
    const pid = prozesse.get(app.id);
    if (pid && pidLebt(pid)) return { laeuft: true, pid };
    if (app.port && await portOffen(app.port)) return { laeuft: true, pid: null };
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
    if (process.platform === "win32") exec(`taskkill /pid ${pid} /t /f`);
    else { try { process.kill(-pid, "SIGTERM"); } catch (e) { process.kill(pid, "SIGTERM"); } }
    prozesse.delete(app.id);
    console.log(`[stopp] ${app.id} (PID ${pid})`);
  }

  function antworte(res, code, daten) {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    });
    res.end(JSON.stringify(daten));
  }

  const tokenOk = req => req.headers.authorization === `Bearer ${konfig.token}`;

  const server = http.createServer(async (req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "OPTIONS") return antworte(res, 204, {});
    if (req.method === "GET" && url === "/ping")
      return antworte(res, 200, { ok: true, agent: "homelab", version: VERSION, name: konfig.name || os.hostname() });
    if (!tokenOk(req)) return antworte(res, 401, { fehler: "Token fehlt oder falsch (Authorization: Bearer <token>)" });

    if (req.method === "GET" && url === "/status") {
      const liste = [];
      for (const app of echteApps) {
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

    if (req.method === "GET" && url === "/check") {
      const schritte = [];
      // Node
      const major = parseInt(process.versions.node.split(".")[0], 10);
      schritte.push({ schritt: "Node.js", ampel: major >= 18 ? "ok" : "fehler",
        text: major >= 18 ? `Node ${process.versions.node}` : `Node ${process.versions.node} zu alt (mind. 18)` });
      // Konfiguration
      schritte.push({ schritt: "Konfiguration", ampel: konfig.token ? "ok" : "fehler",
        text: konfig.token ? `Name „${konfig.name || os.hostname()}", Port ${PORT}` : "Token fehlt in config.json" });
      // Apps
      if (!echteApps.length) schritte.push({ schritt: "Apps", ampel: "warn", text: "keine echten Apps in apps.json (nur Vorlagen)" });
      else {
        const fehlOrdner = echteApps.filter(a => a.cwd && !fs.existsSync(a.cwd)).map(a => a.id);
        schritte.push({ schritt: "Apps", ampel: fehlOrdner.length ? "warn" : "ok",
          text: `${echteApps.length} App(s): ${echteApps.map(a => a.id).join(", ")}` + (fehlOrdner.length ? ` – Ordner fehlt bei: ${fehlOrdner.join(", ")}` : "") });
      }
      // Netzwerk
      const ips = eigeneIps();
      schritte.push({ schritt: "Netzwerk", ampel: ips.length ? "ok" : "fehler",
        text: ips.length ? ips.map(ip => `${ip}:${PORT}`).join("  ") : "keine Netzwerkadresse" });
      const fehler = schritte.filter(s => s.ampel === "fehler").length;
      return antworte(res, 200, { ok: true, name: konfig.name || os.hostname(), bereit: fehler === 0, schritte });
    }

    const start = url.match(/^\/start\/([\w-]+)$/);
    const stopp = url.match(/^\/stop\/([\w-]+)$/);
    if (req.method === "POST" && (start || stopp)) {
      const id = (start || stopp)[1];
      const app = echteApps.find(a => a.id === id);
      if (!app) return antworte(res, 404, { fehler: `App '${id}' steht nicht in apps.json (Whitelist)` });
      try {
        if (start) {
          const s = await appLaeuft(app);
          if (s.laeuft) return antworte(res, 200, { ok: true, hinweis: "läuft bereits", pid: s.pid });
          return antworte(res, 200, { ok: true, pid: starteApp(app) });
        }
        stoppeApp(app);
        return antworte(res, 200, { ok: true });
      } catch (e) {
        return antworte(res, 500, { fehler: e.message });
      }
    }

    antworte(res, 404, { fehler: "unbekannter Endpunkt (kenne /ping /status /check /start/<id> /stop/<id>)" });
  });

  server.listen(PORT, "0.0.0.0", () => {
    const ips = eigeneIps();
    console.log(`HomeLab-Agent v${VERSION} auf ${konfig.name || os.hostname()}`);
    console.log(`Erreichbar im Heimnetz unter: ${ips.map(ip => `http://${ip}:${PORT}`).join("  ") || `http://localhost:${PORT}`}`);
    if (echteApps.length) console.log(`${echteApps.length} App(s) in der Whitelist: ${echteApps.map(a => a.id).join(", ")}`);
    else console.log("⚠ apps.json enthält noch keine echten Apps – Vorlage-Einträge bitte ersetzen.");
    console.log("Diese Adresse im Dashboard beim jeweiligen Rechner als Agent-Adresse eintragen.");
  });
}

/* ---------- Ablauf ---------- */

(async () => {
  if (process.argv.includes("--setup")) { // nur Einrichtung (für den Installer), ohne Server zu starten
    if (fs.existsSync(KONFIG_PFAD)) console.log("Bereits eingerichtet (config.json vorhanden) – Einrichtung übersprungen.");
    else await assistent();
    return;
  }
  const pruefIdx = process.argv.findIndex(a => a === "--pruefe" || a === "--check");
  if (pruefIdx !== -1) return pruefeSchritte(process.argv[pruefIdx + 1], process.argv[pruefIdx + 2]);
  const scanIdx = process.argv.indexOf("--scan");
  if (scanIdx !== -1) return netzScan(process.argv[scanIdx + 1], process.argv[scanIdx + 2]);
  if (process.argv.includes("--autostart")) return richteAutostartEin();
  if (!fs.existsSync(KONFIG_PFAD)) await assistent();
  starteAgent();
})();
