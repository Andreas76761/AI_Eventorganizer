#!/usr/bin/env node
/* ============================================================================
   KI-Projekte suchen – findet auf DIESEM PC alle Projekte und ordnet sie
   dem Werkzeug zu, mit dem sie gebaut wurden:
     Claude · Codex · Perplexity · Lovable · OpenAI/GPT · Gemini

   Ausfuehren:  node ki-projekte-suchen.js          (Benutzerprofil + Laufwerke)
                node ki-projekte-suchen.js "D:\\Ordner"   (zusaetzlich ein Ordner)

   Erkennung je Projekt an: Ordnername, Marker-Dateien (AGENTS.md, CLAUDE.md,
   .codex, .claude, .lovable), README und package.json.
   Es wird nur gelesen und eine Datei geschrieben (ki-projekte-<PC>.txt).
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
  "OneDriveTemp", "Temp", "tmp", ".vscode", ".idea"]);

const START = Date.now();
const ZEIT_BUDGET_MS = 150000;
let besucht = 0, abgebrochen = false;
const projekte = [];

function liesKlein(dir, dateiname, max = 16000) {
  try {
    const f = fs.readdirSync(dir).find(n => n.toLowerCase() === dateiname.toLowerCase());
    if (!f) return "";
    return fs.readFileSync(path.join(dir, f), "utf8").slice(0, max).toLowerCase();
  } catch (e) { return ""; }
}
function liesReadme(dir) {
  try {
    const f = fs.readdirSync(dir).find(n => /^readme(\.md|\.txt)?$/i.test(n));
    return f ? fs.readFileSync(path.join(dir, f), "utf8").slice(0, 16000).toLowerCase() : "";
  } catch (e) { return ""; }
}
function hat(filesLower, name) { return filesLower.has(name.toLowerCase()); }

// gibt Array [{ tool, grund }] zurueck
function erkenneWerkzeuge(dir, filesLower) {
  const name = path.basename(dir).toLowerCase();
  const readme = liesReadme(dir);
  const pkg = liesKlein(dir, "package.json");
  const html = liesKlein(dir, "index.html");
  const meta = liesKlein(dir, "metadata.json");
  const env = liesKlein(dir, ".env.example") + liesKlein(dir, ".env.local");
  const alles = readme + " " + pkg + " " + html + " " + meta + " " + env;
  const treffer = [];
  const add = (tool, grund) => treffer.push({ tool, grund });

  if (name.includes("claude")) add("Claude", "Ordnername");
  else if (hat(filesLower, "claude.md") || hat(filesLower, ".claude")) add("Claude", "CLAUDE.md/.claude");
  else if (/\banthropic\b|mit claude|with claude|claude fable|claude code/.test(alles)) add("Claude", "README/Config");

  if (name.includes("codex")) add("Codex", "Ordnername");
  else if (hat(filesLower, "agents.md") || hat(filesLower, ".codex")) add("Codex", "AGENTS.md/.codex");
  else if (/\bcodex\b/.test(alles)) add("Codex", "README/Config");

  if (name.includes("perplexity")) add("Perplexity", "Ordnername");
  else if (/perplexity/.test(alles)) add("Perplexity", "README/Config/HTML");

  if (name.includes("lovable")) add("Lovable", "Ordnername");
  else if (/lovable/.test(alles)) add("Lovable", "README/package.json/HTML");

  if (name.includes("openai") || name.includes("gpt")) add("OpenAI/GPT", "Ordnername");
  else if (/"openai"|chatgpt|gpt-4|gpt-engineer|gpt engineer|built with gpt/.test(alles)) add("OpenAI/GPT", "README/package.json");

  if (name.includes("gemini")) add("Gemini", "Ordnername");
  else if (/ai studio|@google\/genai|@google\/generative-ai|gemini_api_key|gemini-/.test(alles)) add("Gemini", "AI-Studio/Gemini-Marker");

  return treffer;
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
    if (tm) stand = new Date(parseInt(tm[1], 10) * 1000).toISOString().slice(0, 10);
  } catch (e) {}
  return { remote, stand };
}

function istProjekt(filesLower) {
  return hat(filesLower, ".git") || hat(filesLower, "package.json") ||
    hat(filesLower, "index.html") || [...filesLower].some(n => /^readme/.test(n)) ||
    hat(filesLower, "agents.md") || hat(filesLower, "claude.md");
}

function durchsuche(start, maxTiefe) {
  if (abgebrochen) return;
  if (Date.now() - START > ZEIT_BUDGET_MS) { abgebrochen = true; return; }
  let eintraege;
  try { eintraege = fs.readdirSync(start, { withFileTypes: true }); } catch (e) { return; }
  besucht++;
  const filesLower = new Set(eintraege.map(e => e.name.toLowerCase()));

  if (istProjekt(filesLower)) {
    const werkzeuge = erkenneWerkzeuge(start, filesLower);
    const g = gitInfo(start);
    projekte.push({ pfad: start, werkzeuge, ...g });
    return; // Projekt gefunden – nicht tiefer hinein
  }
  if (maxTiefe <= 0) return;
  for (const e of eintraege) {
    if (e.isDirectory() && !UEBERSPRINGEN.has(e.name) && !e.name.startsWith("$")) {
      durchsuche(path.join(start, e.name), maxTiefe - 1);
    }
  }
}

P("============================================================");
P("  KI-Projekte auf " + os.hostname());
P("  (Claude · Codex · Perplexity · Lovable · OpenAI/GPT · Gemini)");
P("============================================================");

const wurzeln = [];
const dazu = (w, t) => { try { if (fs.statSync(w).isDirectory()) wurzeln.push([w, t]); } catch (e) {} };
dazu(os.homedir(), 7);
for (const d of ["C:\\", "D:\\", "E:\\", "F:\\"]) dazu(d, 4);
if (process.argv[2]) dazu(process.argv[2], 8);

P("\nDurchsuche (1–2 Minuten) …");
for (const [w, t] of wurzeln) { P("  " + w); durchsuche(w, t); }

P("\n------------------------------------------------------------");
P(`Ordner geprueft: ${besucht}${abgebrochen ? " (Zeitlimit erreicht)" : ""}`);
P(`Projekte gefunden: ${projekte.length}`);

// Gruppiert nach Werkzeug ausgeben
const WERKZEUGE = ["Claude", "Codex", "Perplexity", "Lovable", "OpenAI/GPT", "Gemini"];
for (const w of WERKZEUGE) {
  const liste = projekte.filter(p => p.werkzeuge.some(t => t.tool === w));
  if (!liste.length) continue;
  P(`\n[${w}: ${liste.length}]`);
  for (const p of liste) {
    const grund = p.werkzeuge.find(t => t.tool === w).grund;
    P(`  • ${path.basename(p.pfad)}  (${grund})`);
    P(`      ${p.pfad}`);
    P(`      GitHub: ${p.remote || "—"}${p.stand ? " · Stand " + p.stand : ""}`);
  }
}

const ohne = projekte.filter(p => !p.werkzeuge.length);
P(`\n[Werkzeug unbekannt: ${ohne.length}]`);
for (const p of ohne) P(`  • ${path.basename(p.pfad)}  –  ${p.pfad}${p.remote ? " (" + p.remote + ")" : ""}`);

P("\n============================================================");
try {
  const ziel = path.join(__dirname, `ki-projekte-${os.hostname()}.txt`);
  fs.writeFileSync(ziel, zeilen.join("\n") + "\n");
  console.log(`\n✔ Liste gespeichert: ${ziel}`);
  console.log("→ Diese Datei (oder die obige Liste) an Claude schicken.");
} catch (e) {
  console.log("\n→ Bitte die obige Liste kopieren und an Claude schicken.");
}
