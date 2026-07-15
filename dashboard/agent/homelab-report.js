#!/usr/bin/env node
/* ============================================================================
   HomeLab-Report – kleines Tool, das EINEN PC beschreibt
   ----------------------------------------------------------------------------
   Zweck: Claude kann sich NICHT über dein WLAN mit den PCs verbinden (Cloud
   hat keinen Zugang ins Heimnetz – so ist es aus Sicherheitsgründen gewollt).
   Dieses Tool ist die Brücke: es sammelt auf dem PC alle wichtigen Infos in
   eine Datei, die du Claude schickst. Damit kann Claude jedem PC helfen,
   ohne Live-Verbindung.

   Bedienung: einfach ausführen (kein Setup, keine Installation, kein Token):
       node homelab-report.js
   oder Doppelklick auf  Report-erstellen.bat

   Ergebnis: homelab-report-<PCNAME>.txt  (lesbar) neben dieser Datei.
   Diese TXT schickst du Claude im Chat.

   Es werden NUR gelesen: PC-Name/OS, Node-Version, Netzwerkadresse und
   lokale Projektordner mit ihrer GitHub-Adresse. KEINE Passwörter, keine
   Dateiinhalte, nichts wird gesendet – das Tool schreibt nur eine Datei.
   ============================================================================ */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const zeilen = [];
const P = t => { zeilen.push(t); console.log(t); };

P("=".repeat(60));
P("  HomeLab-Report");
P("=".repeat(60));

/* ---------- System ---------- */
P("\n[System]");
P(`  PC-Name:      ${os.hostname()}`);
P(`  Betriebssyst: ${os.type()} ${os.release()} (${os.platform()}/${os.arch()})`);
P(`  Node.js:      ${process.version}`);
P(`  Angemeldet:   ${os.userInfo().username}`);
P(`  Betriebszeit: ${Math.round(os.uptime() / 3600)} h`);
P(`  RAM:          ${Math.round(os.totalmem() / 1e9)} GB`);
P(`  CPU-Kerne:    ${os.cpus().length}`);

/* ---------- Netzwerk ---------- */
const ips = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
P("\n[Netzwerk (WLAN/LAN)]");
P(ips.length ? ips.map(ip => "  " + ip).join("\n") : "  keine Netzwerkadresse gefunden");

/* ---------- Agent installiert? ---------- */
P("\n[HomeLab-Agent]");
const agentHier = fs.existsSync(path.join(__dirname, "homelab-agent.js"));
const konfigHier = fs.existsSync(path.join(__dirname, "config.json"));
P(`  homelab-agent.js vorhanden: ${agentHier ? "ja" : "nein"}`);
if (konfigHier) {
  try {
    const k = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
    P(`  eingerichtet als: „${k.name || os.hostname()}" auf Port ${k.port || 9800}`);
  } catch (e) { P("  config.json vorhanden, aber nicht lesbar"); }
} else {
  P("  noch nicht eingerichtet (keine config.json)");
}

/* ---------- Projektordner / Git-Repos suchen ---------- */

const UEBERSPRINGEN = new Set(["node_modules", ".git", "AppData", "Windows", "Program Files",
  "Program Files (x86)", "ProgramData", "$Recycle.Bin", "dist", "build", ".cache", "vendor"]);

function findeRepos(start, maxTiefe, gefunden) {
  let eintraege;
  try { eintraege = fs.readdirSync(start, { withFileTypes: true }); } catch (e) { return; }
  if (eintraege.some(e => e.isDirectory() && e.name === ".git")) {
    gefunden.push(start);
    return; // nicht weiter in ein Repo hineinsteigen
  }
  if (maxTiefe <= 0) return;
  for (const e of eintraege) {
    if (e.isDirectory() && !UEBERSPRINGEN.has(e.name) && !e.name.startsWith(".")) {
      findeRepos(path.join(start, e.name), maxTiefe - 1, gefunden);
    }
  }
}

function repoInfo(dir) {
  const info = { pfad: dir, remote: null, letzterCommit: null };
  // Remote-URL aus .git/config lesen (ohne git-Installation)
  try {
    const conf = fs.readFileSync(path.join(dir, ".git", "config"), "utf8");
    const m = conf.match(/url\s*=\s*(.+)/);
    if (m) info.remote = m[1].trim();
  } catch (e) { /* egal */ }
  // Letzten Commit aus .git/logs/HEAD lesen
  try {
    const log = fs.readFileSync(path.join(dir, ".git", "logs", "HEAD"), "utf8").trim();
    const letzte = log.split("\n").pop();
    const tm = letzte.match(/> (\d+) [+-]\d+\t(.+)/);
    if (tm) {
      const datum = new Date(parseInt(tm[1], 10) * 1000).toISOString().slice(0, 10);
      info.letzterCommit = `${datum} – ${tm[2].slice(0, 60)}`;
    }
  } catch (e) { /* egal */ }
  return info;
}

// Suchwurzeln: Home + gängige Projektordner, die es tatsächlich gibt
const kandidaten = [
  os.homedir(),
  path.join(os.homedir(), "Documents"),
  path.join(os.homedir(), "Desktop"),
  path.join(os.homedir(), "Projekte"),
  path.join(os.homedir(), "Projects"),
  "C:\\2026", "C:\\Projekte", "C:\\Projects", "C:\\dev", "C:\\git", "C:\\Code",
  "D:\\2026", "D:\\Projekte", "D:\\Projects",
];
const wurzeln = [...new Set(kandidaten)].filter(w => { try { return fs.statSync(w).isDirectory(); } catch (e) { return false; } });

P("\n[Suche nach Projektordnern …]");
P("  durchsucht: " + wurzeln.join(", "));
const repos = [];
for (const w of wurzeln) findeRepos(w, 4, repos);
const einzigartig = [...new Map(repos.map(r => [r, r])).keys()];

P(`\n[Gefundene Projekte: ${einzigartig.length}]`);
if (!einzigartig.length) {
  P("  keine Git-Projekte in den üblichen Ordnern gefunden");
  P("  (Falls dein Code woanders liegt: diese Datei einfach in den Projektordner kopieren und dort ausführen.)");
} else {
  for (const dir of einzigartig) {
    const i = repoInfo(dir);
    P(`  • ${path.basename(dir)}`);
    P(`      Pfad:   ${i.pfad}`);
    P(`      GitHub: ${i.remote || "— (noch nicht mit GitHub verbunden)"}`);
    P(`      Stand:  ${i.letzterCommit || "—"}`);
  }
}

/* ---------- Datei schreiben ---------- */
P("\n" + "=".repeat(60));
const ziel = path.join(__dirname, `homelab-report-${os.hostname()}.txt`);
try {
  fs.writeFileSync(ziel, zeilen.join("\n") + "\n");
  console.log(`\n✔ Report gespeichert: ${ziel}`);
  console.log("→ Diese Datei jetzt Claude im Chat schicken (Inhalt kopieren oder Datei anhängen).");
} catch (e) {
  console.log("\nReport konnte nicht gespeichert werden: " + e.message);
  console.log("→ Stattdessen einfach die obige Ausgabe kopieren und Claude schicken.");
}
