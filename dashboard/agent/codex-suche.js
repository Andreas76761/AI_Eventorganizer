#!/usr/bin/env node
/* ============================================================================
   Codex-Projekte suchen – findet auf DIESEM PC alle Projekte, die mit
   Codex (OpenAI) gebaut wurden, und listet sie auf.

   Ausfuehren:  node codex-suche.js        (durchsucht das ganze Benutzerprofil
                                             und die Laufwerke, Standardordner)
                node codex-suche.js "D:\\"  (zusaetzlich einen eigenen Ordner)

   Ein Projekt gilt als Codex-Projekt, wenn eines zutrifft:
     - Ordnername enthaelt "codex"
     - eine Datei AGENTS.md liegt darin (Codex-Konvention)
     - ein Ordner/Datei .codex liegt darin
     - README erwaehnt "codex"

   Es wird nur gelesen und eine Datei geschrieben (codex-projekte-<PC>.txt).
   Nichts wird gesendet.
   ============================================================================ */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const zeilen = [];
const P = t => { zeilen.push(t); console.log(t); };

const UEBERSPRINGEN = new Set(["node_modules", ".git", "AppData", "Windows",
  "Program Files", "Program Files (x86)", "ProgramData", "$Recycle.Bin",
  "System Volume Information", "dist", "build", ".cache", "vendor",
  "OneDriveTemp", "Temp", "tmp"]);

const START = Date.now();
const ZEIT_BUDGET_MS = 120000; // nach 2 Minuten abbrechen
let besucht = 0, abgebrochen = false;
const gefunden = [];

function istDatei(dir, name) {
  try { return fs.readdirSync(dir).some(f => f.toLowerCase() === name.toLowerCase()); }
  catch (e) { return false; }
}

function readmeErwaehntCodex(dir) {
  try {
    const f = fs.readdirSync(dir).find(n => /^readme(\.md|\.txt)?$/i.test(n));
    if (!f) return false;
    return /codex/i.test(fs.readFileSync(path.join(dir, f), "utf8").slice(0, 8000));
  } catch (e) { return false; }
}

function gitInfo(dir) {
  let remote = "", stand = "";
  try {
    const m = fs.readFileSync(path.join(dir, ".git", "config"), "utf8").match(/url\s*=\s*(.+)/);
    if (m) remote = m[1].trim();
  } catch (e) {}
  try {
    const log = fs.readFileSync(path.join(dir, ".git", "logs", "HEAD"), "utf8").trim().split("\n").pop();
    const tm = log.match(/> (\d+) [+-]\d+\t(.+)/);
    if (tm) stand = new Date(parseInt(tm[1], 10) * 1000).toISOString().slice(0, 10) + " – " + tm[2].slice(0, 50);
  } catch (e) {}
  return { remote, stand };
}

function pruefe(dir) {
  const gruende = [];
  if (/codex/i.test(path.basename(dir))) gruende.push("Ordnername");
  if (istDatei(dir, "AGENTS.md")) gruende.push("AGENTS.md");
  if (istDatei(dir, ".codex")) gruende.push(".codex");
  if (readmeErwaehntCodex(dir)) gruende.push("README nennt Codex");
  return gruende;
}

function durchsuche(start, maxTiefe) {
  if (abgebrochen) return;
  if (Date.now() - START > ZEIT_BUDGET_MS) { abgebrochen = true; return; }
  let eintraege;
  try { eintraege = fs.readdirSync(start, { withFileTypes: true }); } catch (e) { return; }
  besucht++;

  const gruende = pruefe(start);
  if (gruende.length) {
    const g = gitInfo(start);
    gefunden.push({ pfad: start, gruende, ...g });
    return; // Treffer: nicht tiefer hineinsteigen
  }
  if (maxTiefe <= 0) return;
  for (const e of eintraege) {
    if (e.isDirectory() && !UEBERSPRINGEN.has(e.name) && !e.name.startsWith("$")) {
      durchsuche(path.join(start, e.name), maxTiefe - 1);
    }
  }
}

P("============================================================");
P("  Codex-Projekte auf " + os.hostname());
P("============================================================");

// Suchwurzeln: Benutzerprofil (tief) + gaengige Laufwerke/Ordner (flacher) + Argument
const wurzeln = [];
const dazu = (w, t) => { try { if (fs.statSync(w).isDirectory()) wurzeln.push([w, t]); } catch (e) {} };
dazu(os.homedir(), 7);
for (const d of ["C:\\", "D:\\", "E:\\", "F:\\"]) dazu(d, 4);
if (process.argv[2]) dazu(process.argv[2], 8);

P("\nDurchsuche (das kann 1–2 Minuten dauern) …");
for (const [w, t] of wurzeln) { P("  " + w); durchsuche(w, t); }

// ~/.codex als zusaetzlicher Hinweis, dass Codex hier benutzt wurde
const codexHome = path.join(os.homedir(), ".codex");
const codexBenutzt = fs.existsSync(codexHome);

P("\n------------------------------------------------------------");
P(`Codex auf diesem PC benutzt: ${codexBenutzt ? "ja (~/.codex vorhanden)" : "kein ~/.codex gefunden"}`);
P(`Ordner geprueft: ${besucht}${abgebrochen ? " (Zeitlimit erreicht – ggf. Ordner als Argument gezielt angeben)" : ""}`);
P(`\n[Gefundene Codex-Projekte: ${gefunden.length}]`);
if (!gefunden.length) {
  P("  keine gefunden");
} else {
  for (const g of gefunden) {
    P(`  • ${path.basename(g.pfad)}`);
    P(`      Pfad:    ${g.pfad}`);
    P(`      Erkannt: ${g.gruende.join(", ")}`);
    P(`      GitHub:  ${g.remote || "— (nicht mit GitHub verbunden)"}`);
    P(`      Stand:   ${g.stand || "—"}`);
  }
}

P("\n============================================================");
try {
  const ziel = path.join(__dirname, `codex-projekte-${os.hostname()}.txt`);
  fs.writeFileSync(ziel, zeilen.join("\n") + "\n");
  console.log(`\n✔ Liste gespeichert: ${ziel}`);
  console.log("→ Diese Datei (oder die obige Liste) an Claude schicken.");
} catch (e) {
  console.log("\n→ Bitte die obige Liste kopieren und an Claude schicken.");
}
