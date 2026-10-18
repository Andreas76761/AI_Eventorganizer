#!/usr/bin/env node
/* ============================================================================
   GitHub-Upload – laedt lokale Projekte dieses PCs als PRIVATE Repos zu GitHub.

   In zwei Schritten (sicher – du siehst erst, was passiert):

     1) node github-upload.js scan
        Sucht deine Projekte und schreibt "upload-plan.txt".
        -> Datei oeffnen, Zeilen loeschen, die NICHT hochgeladen werden sollen,
           Repo-Namen bei Bedarf anpassen.

     2) node github-upload.js run
        Legt je Zeile ein PRIVATES GitHub-Repo an und pusht den Code.

   Voraussetzung: ein GitHub-Token (fine-grained PAT mit "Contents: Read/Write"
   und "Administration: Read/Write" fuer neue Repos). Token entweder als
   Umgebungsvariable GITHUB_TOKEN oder in der Datei github-token.txt (neben
   dieser Datei) hinterlegen. Das Token wird nur benutzt, NICHT gespeichert
   oder ausgegeben.
   ============================================================================ */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const { spawnSync } = require("node:child_process");

const PLAN = path.join(__dirname, "upload-plan.txt");

/* ---------- Hilfen ---------- */
function git(args, cwd) { return spawnSync("git", args, { cwd, encoding: "utf8" }); }
function hatGit() { const r = spawnSync("git", ["--version"], { encoding: "utf8" }); return r.status === 0; }

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try { return fs.readFileSync(path.join(__dirname, "github-token.txt"), "utf8").trim(); } catch (e) { return ""; }
}

function api(method, p, tok, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.github.com", path: p, method,
      headers: {
        "User-Agent": "homelab-upload", Authorization: "Bearer " + tok,
        Accept: "application/vnd.github+json",
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, r => { let b = ""; r.on("data", c => b += c); r.on("end", () => { let j = {}; try { j = JSON.parse(b); } catch (e) {} resolve({ status: r.statusCode, json: j }); }); });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}

/* ---------- Projekte finden (nur echte, kein Rauschen) ---------- */
const UEBERSPRINGEN = new Set(["node_modules", ".git", "AppData", "Windows", "Program Files",
  "Program Files (x86)", "ProgramData", "$Recycle.Bin", "System Volume Information", "dist",
  "build", ".cache", "vendor", "OneDriveTemp", "Temp", "tmp"]);
const RAUSCH_PFAD = /[\\/]node_modules[\\/]|knime|python\d|[\\/]downloads[\\/]|webview2|\.metadata|eigene programme|[\\/]programme[\\/]|html2canvas-package/i;

function istProjekt(files) {
  const s = new Set(files.map(f => f.toLowerCase()));
  return s.has(".git") || s.has("package.json") || s.has("index.html") ||
    [...s].some(n => /^readme/.test(n));
}

function scanne(start, tiefe, treffer) {
  if (tiefe < 0) return;
  let eintraege; try { eintraege = fs.readdirSync(start, { withFileTypes: true }); } catch (e) { return; }
  if (RAUSCH_PFAD.test(start)) return;
  if (istProjekt(eintraege.map(e => e.name))) { treffer.push(start); return; }
  for (const e of eintraege) {
    if (e.isDirectory() && !UEBERSPRINGEN.has(e.name) && !e.name.startsWith("$")
        && !e.name.startsWith(".") && !/^python\d/i.test(e.name)) {
      scanne(path.join(start, e.name), tiefe - 1, treffer);
    }
  }
}

function hatRemote(dir) {
  const r = git(["remote", "get-url", "origin"], dir);
  return r.status === 0 && r.stdout.trim();
}

function repoName(dir, benutzt) {
  let n = path.basename(dir).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "projekt";
  let basis = n, i = 2; while (benutzt.has(n.toLowerCase())) n = basis + "-" + i++;
  benutzt.add(n.toLowerCase()); return n;
}

/* ---------- Schritt 1: scan ---------- */
function scan() {
  const wurzeln = [];
  const dazu = w => { try { if (fs.statSync(w).isDirectory()) wurzeln.push(w); } catch (e) {} };
  [os.homedir(), path.join(os.homedir(), "Documents"), path.join(os.homedir(), "Desktop"),
   "C:\\2026", "C:\\Andreas_2026", "C:\\2025"].forEach(dazu);

  const treffer = [];
  for (const w of wurzeln) scanne(w, 5, treffer);
  const einzig = [...new Set(treffer)];

  const benutzt = new Set();
  const zeilen = [];
  let schon = 0;
  for (const dir of einzig) {
    if (hatRemote(dir)) { schon++; continue; } // bereits mit GitHub verbunden
    zeilen.push(`${dir}\t${repoName(dir, benutzt)}\tprivate`);
  }
  fs.writeFileSync(PLAN, "# Spalten: Ordner <TAB> Repo-Name <TAB> private|public\n" +
    "# Zeilen loeschen, die NICHT hochgeladen werden sollen. Dann: node github-upload.js run\n" +
    zeilen.join("\n") + "\n");
  console.log(`✔ ${zeilen.length} Projekt(e) in ${path.basename(PLAN)} eingetragen` +
    (schon ? ` (${schon} bereits mit GitHub verbunden, uebersprungen)` : ""));
  console.log(`→ Datei pruefen/kuerzen, dann:  node github-upload.js run`);
}

/* ---------- Schritt 2: run ---------- */
async function run() {
  const tok = token();
  if (!tok) { console.error("FEHLER: Kein GitHub-Token. GITHUB_TOKEN setzen oder github-token.txt anlegen."); process.exit(1); }
  if (!fs.existsSync(PLAN)) { console.error("FEHLER: upload-plan.txt fehlt – zuerst: node github-upload.js scan"); process.exit(1); }
  if (!hatGit()) { console.error("FEHLER: git ist nicht installiert (https://git-scm.com)."); process.exit(1); }

  const me = await api("GET", "/user", tok);
  if (me.status !== 200 || !me.json.login) { console.error("FEHLER: Token ungueltig (GET /user " + me.status + ")."); process.exit(1); }
  const owner = me.json.login;
  console.log(`Angemeldet als ${owner}. Lege private Repos an …\n`);

  const zeilen = fs.readFileSync(PLAN, "utf8").split("\n")
    .map(z => z.trim()).filter(z => z && !z.startsWith("#"));
  let ok = 0, fehler = 0;
  for (const z of zeilen) {
    const [dir, name, sicht] = z.split("\t").map(s => (s || "").trim());
    if (!dir || !name) continue;
    process.stdout.write(`• ${name} … `);
    try {
      if (!fs.existsSync(dir)) { console.log("Ordner fehlt – uebersprungen"); fehler++; continue; }
      // git vorbereiten
      if (!fs.existsSync(path.join(dir, ".git"))) git(["init"], dir);
      git(["add", "-A"], dir);
      git(["-c", "user.email=homelab@local", "-c", "user.name=HomeLab", "commit", "-m", "Initial import"], dir);
      git(["branch", "-M", "main"], dir);
      // Repo anlegen
      const erstellt = await api("POST", "/user/repos", tok, { name, private: sicht !== "public", auto_init: false });
      if (erstellt.status !== 201 && erstellt.status !== 422) { console.log("Repo-Fehler HTTP " + erstellt.status); fehler++; continue; }
      // push (Token nur in der Remote-URL, danach entfernt)
      const url = `https://${owner}:${tok}@github.com/${owner}/${name}.git`;
      git(["remote", "remove", "origin"], dir);
      git(["remote", "add", "origin", url], dir);
      const push = git(["push", "-u", "origin", "main"], dir);
      git(["remote", "set-url", "origin", `https://github.com/${owner}/${name}.git`], dir); // Token aus URL entfernen
      if (push.status === 0) { console.log(`OK → github.com/${owner}/${name}`); ok++; }
      else { console.log("Push-Fehler: " + (push.stderr || "").split("\n")[0]); fehler++; }
    } catch (e) { console.log("Fehler: " + e.message); fehler++; }
  }
  console.log(`\nFertig: ${ok} hochgeladen, ${fehler} Fehler. Repos sind PRIVAT.`);
}

/* ---------- Ablauf ---------- */
const befehl = process.argv[2];
if (befehl === "scan") scan();
else if (befehl === "run") run();
else {
  console.log("HomeLab GitHub-Upload");
  console.log("  node github-upload.js scan   – Projekte finden, upload-plan.txt schreiben");
  console.log("  node github-upload.js run    – Projekte aus dem Plan als private Repos hochladen");
}
