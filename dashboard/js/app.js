/* HomeLab App-Dashboard – Phase 1 (MVP)
   Übersicht, Suche/Filter, Gruppierung nach Werkzeug, PC-Übersicht,
   GitHub/Vercel-Ansicht mit Live-Erreichbarkeitscheck (im Browser). */

"use strict";

const STORAGE_KEY = "hld_state_v1";

/* ---------- Zustand ---------- */

let state = ladeZustand();

function ladeZustand() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* korrupter Zustand → neu */ }
  if (!s || !Array.isArray(s.apps)) {
    s = { seedVersion: SEED_VERSION, apps: strukturKopie(SEED_APPS), pcs: strukturKopie(SEED_PCS), checks: {} };
  } else if ((s.seedVersion || 0) < SEED_VERSION) {
    // neue Seed-Apps ergänzen; bei vorhandenen die Inventur-Felder auffrischen,
    // eigene Eingaben (Rechner, gesetzte Werkzeuge/Beschreibungen) aber behalten
    SEED_APPS.forEach(seed => {
      const alt = s.apps.find(a => a.id === seed.id);
      if (!alt) { s.apps.push(strukturKopie(seed)); return; }
      ["beschreibung", "ursprung", "stack", "tags", "vercelUrl", "lokalUrl"].forEach(f => {
        const leer = alt[f] == null || alt[f] === "" || (Array.isArray(alt[f]) && !alt[f].length);
        if (leer && seed[f] !== undefined) alt[f] = strukturKopie(seed[f]);
      });
      ["umfang", "screenshot", "letzterPush", "visibility", "vercelBestaetigt", "doku", "analyse", "performance", "vorschlaege", "technik", "gestartet"].forEach(f => {
        if (seed[f] !== undefined) alt[f] = strukturKopie(seed[f]);
      });
      if (!alt.bewertung && seed.bewertung) alt.bewertung = strukturKopie(seed.bewertung);
    });
    s.seedVersion = SEED_VERSION;
  }
  if (!Array.isArray(s.pcs) || !s.pcs.length) s.pcs = strukturKopie(SEED_PCS);
  if (!s.checks) s.checks = {};
  if (!s.einstellungen) s.einstellungen = { githubToken: "", vercelToken: "" };
  if (!s.hosting) s.hosting = {}; // appId -> {github:{...}, vercel:{...}, Fehler}
  return s;
}

function speichere() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function strukturKopie(x) { return JSON.parse(JSON.stringify(x)); }

/* ---------- Hilfen ---------- */

const $ = sel => document.querySelector(sel);

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function pcName(id) {
  const pc = state.pcs.find(p => p.id === id);
  return pc ? pc.name : "";
}

function neueId(name) {
  const basis = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  let id = basis, n = 2;
  while (state.apps.some(a => a.id === id)) id = basis + "-" + n++;
  return id;
}

/* ---------- Filter-Zustand ---------- */

const filter = { text: "", ursprung: "", rechner: "", hosting: "", status: "" };

function gefilterteApps() {
  const t = filter.text.trim().toLowerCase();
  return state.apps.filter(a => {
    if (t) {
      const heu = [a.name, a.beschreibung, (a.ursprung || []).join(" "), (a.stack || []).join(" "),
        (a.tags || []).join(" "), pcName(a.rechner)].join(" ").toLowerCase();
      if (!heu.includes(t)) return false;
    }
    if (filter.ursprung === "(ohne)" ? (a.ursprung || []).length : filter.ursprung && !(a.ursprung || []).includes(filter.ursprung)) return false;
    if (filter.rechner === "(ohne)" ? a.rechner : filter.rechner && a.rechner !== filter.rechner) return false;
    if (filter.hosting === "github" && !a.github) return false;
    if (filter.hosting === "vercel" && !a.vercelUrl) return false;
    if (filter.hosting === "lokal" && !a.lokalUrl) return false;
    if (filter.status && (a.status || "aktiv") !== filter.status) return false;
    return true;
  });
}

/* ---------- Erreichbarkeitscheck (läuft im Browser des Nutzers) ---------- */

async function pruefeUrl(url) {
  // no-cors: opaque Antwort => Server erreichbar; Netzwerkfehler => nicht erreichbar
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(8000) });
    return "ok";
  } catch (e) {
    return "fehler";
  }
}

async function pruefeApp(app) {
  for (const [feld, url] of [["vercel", app.vercelUrl], ["lokal", app.lokalUrl]]) {
    if (!url) continue;
    state.checks[app.id + ":" + feld] = { status: "läuft" };
    render();
    const erg = await pruefeUrl(url);
    state.checks[app.id + ":" + feld] = { status: erg, zeit: new Date().toLocaleString("de-DE") };
    speichere();
    render();
  }
}

/* ---------- Bewertung (Phase 2) ---------- */

const KRITERIEN = [
  { key: "nutzen", label: "Nutzen", hilfe: "Wie viel bringt dir die App im Alltag?" },
  { key: "reifegrad", label: "Reifegrad", hilfe: "Wie fertig/stabil ist sie?" },
  { key: "wartbarkeit", label: "Wartbarkeit", hilfe: "Wie leicht lässt sie sich ändern/erweitern?" },
  { key: "techQualitaet", label: "Tech-Qualität", hilfe: "Stack, Code-Struktur, Handwerk" },
  { key: "zukunft", label: "Zukunftsfähigkeit", hilfe: "Lohnt der Weiterausbau?" },
];

function appScore(a) {
  const b = a.bewertung || {};
  const werte = KRITERIEN.map(k => b[k.key]).filter(v => v >= 1);
  if (!werte.length) return null;
  return werte.reduce((summe, v) => summe + v, 0) / werte.length;
}

function sterne(wert) {
  if (!wert || wert < 1) return '<span class="leer">–</span>';
  const voll = Math.round(wert);
  return `<span class="sterne" title="${wert.toFixed(1)} von 5">${"★".repeat(voll)}${"☆".repeat(5 - voll)}</span>`;
}

let tempBewertung = null;

function sternZeileHtml(key) {
  const wert = tempBewertung[key] || 0;
  return Array.from({ length: 5 }, (_, i) =>
    `<button type="button" class="stern${i < wert ? " an" : ""}" onclick="setzeStern('${key}',${i + 1})">${i < wert ? "★" : "☆"}</button>`
  ).join("") + `<span class="hinweis" style="margin:0 0 0 .5rem">${wert ? wert + "/5" : "unbewertet"}</span>`;
}

function setzeStern(key, wert) {
  tempBewertung[key] = tempBewertung[key] === wert ? 0 : wert; // nochmal klicken = zurücksetzen
  document.getElementById("sterne-" + key).innerHTML = sternZeileHtml(key);
}

function bearbeiteBewertung(id) {
  const a = state.apps.find(x => x.id === id);
  if (!a) return;
  tempBewertung = Object.assign({ nutzen: 0, reifegrad: 0, wartbarkeit: 0, techQualitaet: 0, zukunft: 0 }, a.bewertung || {});
  zeigeModal(`<h3>★ Bewertung: ${esc(a.name)}</h3>
  <p class="hinweis">Klick auf die Sterne (nochmal klicken setzt zurück). Der Gesamt-Score ist der Durchschnitt der bewerteten Kriterien.</p>
  <form onsubmit="speichereBewertung(event,'${id}')">
    ${KRITERIEN.map(k => `<div class="kriterium">
      <div><b>${k.label}</b><br><small class="hinweis" style="margin:0">${k.hilfe}</small></div>
      <div class="sternwahl" id="sterne-${k.key}">${sternZeileHtml(k.key)}</div>
    </div>`).join("")}
    <label>Notiz / Begründung<textarea name="notiz" rows="3">${esc((a.bewertung || {}).notiz || "")}</textarea></label>
    <div class="aktionen">
      <button class="knopf primär" type="submit">Speichern</button>
      <button class="knopf" type="button" onclick="schliesseModal()">Abbrechen</button>
    </div>
  </form>`);
}

function speichereBewertung(ev, id) {
  ev.preventDefault();
  const a = state.apps.find(x => x.id === id);
  if (!a) return;
  a.bewertung = Object.assign({}, tempBewertung, { notiz: ev.target.notiz.value.trim() });
  speichere(); schliesseModal(); render();
}

/* ---------- Agent-Anbindung (PCs im WLAN/Heimnetz) ---------- */

const agentStatus = {}; // pcId -> {online, name, plattform, betriebszeitMin, apps:{id:{laeuft}}, fehler, zeit} – nur im Speicher

async function agentAbruf(pc, pfad, methode) {
  const url = pc.agentUrl.replace(/\/$/, "") + pfad;
  const antwort = await fetch(url, {
    method: methode || "GET",
    headers: pc.agentToken ? { Authorization: "Bearer " + pc.agentToken } : {},
    signal: AbortSignal.timeout(6000),
  });
  const daten = await antwort.json();
  if (!antwort.ok) throw new Error(daten.fehler || ("HTTP " + antwort.status));
  return daten;
}

async function pruefeAgent(pcId) {
  const pc = state.pcs.find(p => p.id === pcId);
  if (!pc || !pc.agentUrl) return;
  agentStatus[pcId] = { laedt: true };
  render();
  try {
    const s = await agentAbruf(pc, "/status");
    const apps = {};
    (s.apps || []).forEach(a => { apps[a.id] = a; });
    agentStatus[pcId] = { online: true, name: s.name, plattform: s.plattform, betriebszeitMin: s.betriebszeitMin, apps, zeit: new Date().toLocaleTimeString("de-DE") };
  } catch (e) {
    agentStatus[pcId] = { online: false, fehler: e.message, zeit: new Date().toLocaleTimeString("de-DE") };
  }
  render();
}

async function pruefeAlleAgents() {
  await Promise.all(state.pcs.filter(p => p.agentUrl).map(p => pruefeAgent(p.id)));
}

async function agentAktion(pcId, appId, aktion) {
  const pc = state.pcs.find(p => p.id === pcId);
  if (!pc) return;
  try {
    await agentAbruf(pc, `/${aktion}/${appId}`, "POST");
  } catch (e) {
    alert(`${aktion === "start" ? "Starten" : "Stoppen"} fehlgeschlagen: ${e.message}`);
  }
  setTimeout(() => pruefeAgent(pcId), 1200); // kurz warten, dann Status auffrischen
}

/* ---------- Netzwerk-Scan: Agents im WLAN finden und Rechner beschriften ---------- */

const scanStatus = { laeuft: false, geprueft: 0, gesamt: 0, gefunden: [] };

async function scanPing(url) {
  try {
    const r = await fetch(url + "/ping", { signal: AbortSignal.timeout(1500) });
    const d = await r.json();
    if (d && d.agent === "homelab") return d;
  } catch (e) { /* kein Agent unter dieser Adresse */ }
  return null;
}

async function starteScan(ev) {
  ev.preventDefault();
  const prefix = ev.target.prefix.value.trim().replace(/\.+$/, "");
  const port = parseInt(ev.target.port.value, 10) || 9800;
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(prefix)) { alert("Bitte die ersten drei Zahlengruppen angeben, z. B. 192.168.178"); return; }
  state.einstellungen.scanPrefix = prefix;
  state.einstellungen.scanPort = port;
  speichere();
  scanStatus.laeuft = true; scanStatus.geprueft = 0; scanStatus.gesamt = 254; scanStatus.gefunden = [];
  render();
  const ips = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
  const BLOCK = 16; // 16 Adressen gleichzeitig, gesamt ~30 s
  for (let i = 0; i < ips.length; i += BLOCK) {
    await Promise.all(ips.slice(i, i + BLOCK).map(async ip => {
      const url = `http://${ip}:${port}`;
      const d = await scanPing(url);
      scanStatus.geprueft++;
      if (d) scanStatus.gefunden.push({ url, name: d.name || ip });
    }));
    if (ansicht === "rechner") render();
  }
  scanStatus.laeuft = false;
  render();
}

function uebernehmeAgent(url, name) {
  let pc = state.pcs.find(p => p.agentUrl === url) // schon bekannt → nur Name auffrischen
        || state.pcs.find(p => p.name === name)
        || state.pcs.find(p => !p.agentUrl);       // erster Rechner ohne Agent
  if (!pc) {
    let nid = "pc" + (state.pcs.length + 1), n = state.pcs.length + 1;
    while (state.pcs.some(p => p.id === nid)) nid = "pc" + ++n;
    pc = { id: nid, name: "", os: "", ort: "", notiz: "" };
    state.pcs.push(pc);
  }
  pc.agentUrl = url;
  pc.name = name; // Beschriftung: Name kommt vom Agent (config.json des PCs)
  speichere();
  render();
  bearbeitePc(pc.id); // direkt öffnen, damit das Token eingetragen werden kann
}

function agentBadge(pcId) {
  const s = agentStatus[pcId];
  const pc = state.pcs.find(p => p.id === pcId);
  if (!pc || !pc.agentUrl) return '<span class="badge offen">kein Agent</span>';
  if (!s) return '<span class="badge offen">Agent ungeprüft</span>';
  if (s.laedt) return '<span class="badge offen">verbinde …</span>';
  if (s.online) return `<span class="badge online" title="geprüft ${esc(s.zeit)}">● verbunden</span>`;
  return `<span class="badge offline" title="${esc(s.fehler || "")} (${esc(s.zeit)})">● offline</span>`;
}

function checkBadge(app, feld) {
  const c = state.checks[app.id + ":" + feld];
  if (!c) return '<span class="ampel grau" title="ungeprüft">●</span>';
  if (c.status === "läuft") return '<span class="ampel gelb" title="Prüfung läuft">●</span>';
  if (c.status === "ok") return `<span class="ampel gruen" title="erreichbar (${esc(c.zeit)})">●</span>`;
  return `<span class="ampel rot" title="nicht erreichbar (${esc(c.zeit)})">●</span>`;
}

/* ---------- Rendern ---------- */

let ansicht = location.hash.replace("#", "") || "uebersicht";
window.addEventListener("hashchange", () => { ansicht = location.hash.replace("#", "") || "uebersicht"; render(); });

function render() {
  document.querySelectorAll(".nav a").forEach(a => a.classList.toggle("aktiv", a.getAttribute("href") === "#" + ansicht));
  const wurzel = $("#inhalt");
  if (ansicht === "werkzeug") wurzel.innerHTML = renderWerkzeug();
  else if (ansicht === "analyse") wurzel.innerHTML = renderAnalyse();
  else if (ansicht === "bewertung") wurzel.innerHTML = renderBewertung();
  else if (ansicht === "rechner") wurzel.innerHTML = renderRechner();
  else if (ansicht === "hosting") wurzel.innerHTML = renderHosting();
  else if (ansicht === "daten") wurzel.innerHTML = renderDaten();
  else wurzel.innerHTML = renderUebersicht();
}

function statistikZeile() {
  const n = state.apps.length;
  const git = state.apps.filter(a => a.github).length;
  const ver = state.apps.filter(a => a.vercelUrl).length;
  const ohne = state.apps.filter(a => !(a.ursprung || []).length).length;
  return `<div class="statzeile">
    <div class="stat"><b>${n}</b><span>Apps</span></div>
    <div class="stat"><b>${state.pcs.length}</b><span>Rechner</span></div>
    <div class="stat"><b>${git}</b><span>auf GitHub</span></div>
    <div class="stat"><b>${ver}</b><span>auf Vercel</span></div>
    <div class="stat${ohne ? " warn" : ""}"><b>${ohne}</b><span>ohne Werkzeug-Zuordnung</span></div>
  </div>`;
}

function appKarte(a) {
  const urspruenge = (a.ursprung || []).map(u => `<span class="badge u-${esc(u.toLowerCase())}">${esc(u)}</span>`).join("") ||
    '<span class="badge offen">Werkzeug?</span>';
  const stack = (a.stack || []).map(s => `<span class="chip">${esc(s)}</span>`).join("");
  const tags = (a.tags || []).map(s => `<span class="chip tag">#${esc(s)}</span>`).join("");
  const links = [];
  if (a.vercelUrl) links.push(`<a class="knopf" href="${esc(a.vercelUrl)}" target="_blank" rel="noopener">▶ Öffnen ${checkBadge(a, "vercel")}${a.vercelBestaetigt || (state.checks[a.id + ":vercel"] || {}).status === "ok" ? "" : " <small>(URL vermutet)</small>"}</a>`);
  if (a.lokalUrl) links.push(`<a class="knopf" href="${esc(a.lokalUrl)}" target="_blank" rel="noopener">🖥 Lokal ${checkBadge(a, "lokal")}</a>`);
  if (a.github) links.push(`<a class="knopf" href="${esc(a.github)}" target="_blank" rel="noopener">GitHub${a.visibility === "private" ? " 🔒" : ""}</a>`);
  return `<div class="karte${(a.status || "aktiv") !== "aktiv" ? " inaktiv" : ""}">
    ${a.screenshot ? `<img class="shot" src="${esc(a.screenshot)}" alt="Screenshot ${esc(a.name)}" loading="lazy" onclick="zeigeShot('${a.id}')" title="Klicken zum Vergrößern">` : ""}
    <div class="karte-kopf">
      <h3>${esc(a.name)}</h3>
      <span style="white-space:nowrap">
        <button class="mini" onclick="bearbeiteBewertung('${a.id}')" title="Bewerten">★</button>
        <button class="mini" onclick="bearbeiteApp('${a.id}')" title="Bearbeiten">✎</button>
      </span>
    </div>
    <div class="badges">${urspruenge}${appScore(a) != null ? `<span class="badge score-badge" title="Gesamt-Score">★ ${appScore(a).toFixed(1)}</span>` : ""}${(a.status || "aktiv") !== "aktiv" ? `<span class="badge offen">${esc(a.status)}</span>` : ""}</div>
    ${a.beschreibung ? `<p>${esc(a.beschreibung)}</p>` : '<p class="leer">Keine Beschreibung – ✎ klicken und ergänzen.</p>'}
    <div class="meta">
      ${a.rechner ? `<span>🖥 ${esc(pcName(a.rechner))}</span>` : '<span class="leer">Rechner?</span>'}
      ${a.gestartet ? `<span>Start: ${esc(a.gestartet)}</span>` : ""}
      ${a.letzterPush ? `<span>Geändert: ${esc(a.letzterPush)}</span>` : ""}
      ${a.umfang && a.umfang.loc ? `<span>${a.umfang.dateien} Dateien · ${a.umfang.loc.toLocaleString("de-DE")} Zeilen</span>` : ""}
    </div>
    ${stack || tags ? `<div class="chips">${stack}${tags}</div>` : ""}
    <div class="aktionen">${links.join("")}
      <button class="knopf" onclick="pruefeAppId('${a.id}')" title="Erreichbarkeit prüfen">⟳ Status</button>
      ${agentKnoepfe(a)}
    </div>
  </div>`;
}

function agentKnoepfe(a) {
  if (!a.rechner) return "";
  const s = agentStatus[a.rechner];
  if (!s || !s.online) return "";
  const eintrag = s.apps[a.id];
  if (!eintrag) return "";
  return eintrag.laeuft
    ? `<span class="badge online">läuft</span><button class="knopf gefahr" onclick="agentAktion('${a.rechner}','${a.id}','stop')">■ Stopp</button>`
    : `<button class="knopf primär" onclick="agentAktion('${a.rechner}','${a.id}','start')">▶ Start</button>`;
}

function renderUebersicht() {
  const apps = gefilterteApps();
  const optU = URSPRUENGE.map(u => `<option${filter.ursprung === u ? " selected" : ""}>${u}</option>`).join("");
  const optR = state.pcs.map(p => `<option value="${p.id}"${filter.rechner === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  return `${statistikZeile()}
  <div class="filterzeile">
    <input id="suche" type="search" placeholder="Suchen: Name, Beschreibung, Stack, Tags …" value="${esc(filter.text)}"
      oninput="filter.text=this.value;render();document.getElementById('suche').focus();document.getElementById('suche').setSelectionRange(9999,9999)">
    <select onchange="filter.ursprung=this.value;render()">
      <option value="">Werkzeug: alle</option>${optU}<option value="(ohne)"${filter.ursprung === "(ohne)" ? " selected" : ""}>ohne Zuordnung</option>
    </select>
    <select onchange="filter.rechner=this.value;render()">
      <option value="">Rechner: alle</option>${optR}<option value="(ohne)"${filter.rechner === "(ohne)" ? " selected" : ""}>ohne Zuordnung</option>
    </select>
    <select onchange="filter.hosting=this.value;render()">
      <option value="">Hosting: alle</option>
      <option value="github"${filter.hosting === "github" ? " selected" : ""}>GitHub</option>
      <option value="vercel"${filter.hosting === "vercel" ? " selected" : ""}>Vercel</option>
      <option value="lokal"${filter.hosting === "lokal" ? " selected" : ""}>Lokal</option>
    </select>
    <select onchange="filter.status=this.value;render()">
      <option value="">Status: alle</option>
      <option value="aktiv"${filter.status === "aktiv" ? " selected" : ""}>aktiv</option>
      <option value="pausiert"${filter.status === "pausiert" ? " selected" : ""}>pausiert</option>
      <option value="archiviert"${filter.status === "archiviert" ? " selected" : ""}>archiviert</option>
    </select>
    <button class="knopf primär" onclick="bearbeiteApp(null)">＋ App</button>
  </div>
  <p class="hinweis">${apps.length} von ${state.apps.length} Apps</p>
  <div class="raster">${apps.map(appKarte).join("") || '<p class="leer">Keine Treffer.</p>'}</div>`;
}

function renderWerkzeug() {
  const gruppen = URSPRUENGE.map(u => ({ titel: u, apps: state.apps.filter(a => (a.ursprung || []).includes(u)) }))
    .filter(g => g.apps.length);
  const ohne = state.apps.filter(a => !(a.ursprung || []).length);
  if (ohne.length) gruppen.push({ titel: "Ohne Zuordnung", apps: ohne });
  return `${statistikZeile()}
  <h2>Apps nach Werkzeug</h2>
  <p class="hinweis">Womit wurde jede App gebaut? Zuordnung über ✎ an der App pflegen – auch mehrere Werkzeuge je App möglich.</p>
  ${gruppen.map(g => `<section class="gruppe">
    <h3>${esc(g.titel)} <span class="anzahl">${g.apps.length}</span></h3>
    <div class="raster">${g.apps.map(appKarte).join("")}</div>
  </section>`).join("")}`;
}

function renderRechner() {
  return `${statistikZeile()}
  <h2>Rechner im Heimnetz</h2>
  <p class="hinweis">Auf jedem PC läuft der <b>HomeLab-Agent</b> (Ordner <code>agent/</code> im Repo, Anleitung dort) –
  er verbindet den Rechner über WLAN/LAN mit diesem Dashboard. Agent-Adresse und Token über ✎ am Rechner eintragen.
  Hinweis: Die Steuerung funktioniert aus dem lokal geöffneten Dashboard (http://…); aus der HTTPS-Vercel-Version
  blockiert der Browser LAN-Zugriffe (Mixed Content).</p>
  <div class="einstellungen" style="margin-bottom:.8rem">
    <b>📡 Netzwerk-Scan:</b> findet alle eingeschalteten Rechner mit laufendem Agent und beschriftet sie automatisch
    mit dem Namen aus deren <code>config.json</code>.
    <form onsubmit="starteScan(event)" style="display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-top:.5rem">
      <label style="display:flex;align-items:center;gap:.4rem">Netz
        <input name="prefix" style="width:130px" value="${esc(state.einstellungen.scanPrefix || "192.168.178")}" title="Die ersten drei Zahlengruppen deiner Heimnetz-Adressen (ipconfig)"></label>
      <label style="display:flex;align-items:center;gap:.4rem">Port
        <input name="port" style="width:70px" value="${esc(String(state.einstellungen.scanPort || 9800))}"></label>
      <button class="knopf primär" type="submit"${scanStatus.laeuft ? " disabled" : ""}>${scanStatus.laeuft ? `🔄 scanne … ${scanStatus.geprueft}/${scanStatus.gesamt}` : "📡 Scan starten"}</button>
      <button class="knopf" type="button" onclick="pruefeAlleAgents()">⟳ Bekannte Rechner verbinden</button>
    </form>
    ${scanStatus.gefunden.length ? `<ul class="appliste" style="margin-top:.5rem">${scanStatus.gefunden.map(f =>
      `<li>🟢 <b>${esc(f.name)}</b> <span class="hinweis" style="margin:0">${esc(f.url)}</span>
        ${state.pcs.some(p => p.agentUrl === f.url) ? '<span class="badge online">übernommen</span>' : `<button class="knopf" onclick="uebernehmeAgent('${esc(f.url)}','${esc(f.name)}')">➕ als Rechner übernehmen</button>`}
      </li>`).join("")}</ul>`
    : (!scanStatus.laeuft && scanStatus.gesamt ? '<p class="hinweis" style="margin:.5rem 0 0">Scan fertig – keine Agents gefunden. Läuft der Agent auf den PCs? Stimmen Netz-Präfix und Port? Firewall (private Netzwerke) erlaubt?</p>' : "")}
  </div>
  <div class="raster pc-raster">
    ${state.pcs.map(pc => {
      const apps = state.apps.filter(a => a.rechner === pc.id);
      const s = agentStatus[pc.id];
      return `<div class="karte pc">
        <div class="karte-kopf"><h3>🖥 ${esc(pc.name)}</h3>
          <button class="mini" onclick="bearbeitePc('${pc.id}')" title="Bearbeiten">✎</button></div>
        <div class="badges">${agentBadge(pc.id)}</div>
        <div class="meta">${pc.os ? `<span>${esc(pc.os)}</span>` : ""}${pc.ort ? `<span>${esc(pc.ort)}</span>` : ""}
          ${s && s.online ? `<span>${esc(s.plattform || "")}</span><span>an seit ${Math.floor((s.betriebszeitMin || 0) / 60)} h ${(s.betriebszeitMin || 0) % 60} min</span>` : ""}</div>
        ${pc.notiz ? `<p>${esc(pc.notiz)}</p>` : ""}
        ${pc.agentUrl ? `<div class="aktionen"><button class="knopf" onclick="pruefeAgent('${pc.id}')">⟳ Verbinden</button><span class="hinweis" style="margin:0">${esc(pc.agentUrl)}</span></div>` : ""}
        <p class="hinweis">${apps.length} App(s) zugeordnet${s && s.online ? ` · ${Object.values(s.apps).filter(x => x.laeuft).length} laufen laut Agent` : ""}</p>
        <ul class="appliste">${apps.map(a => {
          const e = s && s.online ? s.apps[a.id] : null;
          return `<li>${e ? (e.laeuft ? "🟢 " : "⚪ ") : ""}<a href="#uebersicht" onclick="filter.text='${esc(a.name)}'">${esc(a.name)}</a>${agentKnoepfe(a)}</li>`;
        }).join("") || "<li class='leer'>keine zugeordnet</li>"}</ul>
      </div>`;
    }).join("")}
  </div>
  <button class="knopf" onclick="bearbeitePc(null)">＋ Rechner</button>
  <h3 style="margin-top:1.5rem">Noch keinem Rechner zugeordnet</h3>
  <ul class="appliste">${state.apps.filter(a => !a.rechner).map(a => `<li>${esc(a.name)} <button class="mini" onclick="bearbeiteApp('${a.id}')">✎</button></li>`).join("") || "<li class='leer'>alle zugeordnet 🎉</li>"}</ul>`;
}

function renderHosting() {
  const zeilen = state.apps.map(a => {
    const h = state.hosting[a.id] || {};
    const g = h.github;
    return `<tr>
    <td><b>${esc(a.name)}</b></td>
    <td>${a.github ? `<a href="${esc(a.github)}" target="_blank" rel="noopener">${esc(a.github.replace("https://github.com/", ""))}</a> ${a.visibility === "private" ? "🔒" : "🌐"}` : "–"}
      ${h.githubFehler ? `<br><small class="fehltext">${esc(h.githubFehler)}</small>` : ""}</td>
    <td>${g && g.commitMsg ? `${esc(g.commitDatum || "")}<br><small class="hinweis" style="margin:0" title="${esc(g.commitMsg)}">${esc(g.commitMsg.slice(0, 44))}${g.commitMsg.length > 44 ? "…" : ""}</small>` : esc(a.letzterPush || "–")}</td>
    <td>${g ? (g.issues || 0) : "–"}</td>
    <td>${g ? actionsSymbol(g.actions) : "–"}</td>
    <td>${a.vercelUrl ? `${checkBadge(a, "vercel")} <a href="${esc(a.vercelUrl)}" target="_blank" rel="noopener">${esc(a.vercelUrl.replace("https://", ""))}</a>${a.vercelBestaetigt || (state.checks[a.id + ":vercel"] || {}).status === "ok" ? "" : " <small>(vermutet)</small>"}` : "–"}
      ${h.vercel ? `<br>${vercelStatusHtml(h.vercel)}` : ""}${h.vercelFehler ? `<br><small class="fehltext">${esc(h.vercelFehler)}</small>` : ""}</td>
    <td>${a.lokalUrl ? `${checkBadge(a, "lokal")} <a href="${esc(a.lokalUrl)}" target="_blank" rel="noopener">${esc(a.lokalUrl)}</a>` : "–"}</td>
    <td><button class="mini" onclick="pruefeAppId('${a.id}')" title="Erreichbarkeit im Browser prüfen">⟳</button></td>
  </tr>`;
  }).join("");
  return `${statistikZeile()}
  <h2>GitHub &amp; Vercel</h2>
  <details class="einstellungen"${state.einstellungen.githubToken || state.einstellungen.vercelToken ? "" : " open"}>
    <summary>🔑 API-Zugänge (bleiben nur in diesem Browser)</summary>
    <form onsubmit="speichereTokens(event)" class="zweispaltig" style="align-items:end; margin-top:.6rem">
      <label>GitHub-Token (PAT, „Contents: read" genügt; ohne Token: nur öffentliche Repos, 60 Abrufe/h)
        <input name="gh" type="password" value="${esc(state.einstellungen.githubToken)}" placeholder="github_pat_…"></label>
      <label>Vercel-Token (vercel.com → Settings → Tokens)
        <input name="vc" type="password" value="${esc(state.einstellungen.vercelToken)}" placeholder="vercel_…"></label>
      <div class="aktionen"><button class="knopf primär" type="submit">Speichern</button></div>
    </form>
  </details>
  <p class="hinweis">„Live-Daten abrufen" holt je App den letzten Commit, offene Issues und den Actions-Status von GitHub
  sowie das letzte Deployment von Vercel (bestätigt dabei die vermuteten URLs). Der ⟳-Knopf je Zeile prüft zusätzlich
  die Erreichbarkeit direkt aus deinem Browser.
  ${state.hostingZeit ? `<b>Zuletzt abgerufen: ${esc(state.hostingZeit)}</b>` : ""}</p>
  ${state.hostingVercelFehler ? `<p class="fehltext">Vercel-Projektliste: ${esc(state.hostingVercelFehler)}</p>` : ""}
  <p>
    <button class="knopf primär" onclick="aktualisiereHosting()"${hostingLaeuft ? " disabled" : ""}>${hostingLaeuft ? "🔄 läuft …" : "⚡ Live-Daten von GitHub & Vercel abrufen"}</button>
    <button class="knopf" onclick="pruefeAlle()">⟳ Erreichbarkeit aller URLs prüfen</button>
  </p>
  <div class="tabellenrahmen"><table>
    <thead><tr><th>App</th><th>GitHub-Repo</th><th>Letzter Commit</th><th>Issues</th><th>Actions</th><th>Vercel</th><th>Lokal</th><th></th></tr></thead>
    <tbody>${zeilen}</tbody>
  </table></div>`;
}

/* ---------- Phase 3: Live-Daten von GitHub & Vercel ---------- */

let hostingLaeuft = false;
let vercelProjekte = null; // Sitzungs-Cache der Projektliste

function repoPfad(a) {
  const m = (a.github || "").match(/github\.com\/([^/]+\/[^/#?]+)/);
  return m ? m[1].replace(/\.git$/, "") : null;
}

async function githubApi(pfad) {
  const kopf = { Accept: "application/vnd.github+json" };
  if (state.einstellungen.githubToken) kopf.Authorization = "Bearer " + state.einstellungen.githubToken;
  const r = await fetch("https://api.github.com" + pfad, { headers: kopf, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("GitHub HTTP " + r.status + (r.status === 403 ? " (Ratenlimit? Token eintragen)" : r.status === 404 ? " (privates Repo? Token eintragen)" : ""));
  return r.json();
}

async function vercelApi(pfad) {
  const r = await fetch("https://api.vercel.com" + pfad, {
    headers: { Authorization: "Bearer " + state.einstellungen.vercelToken },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("Vercel HTTP " + r.status);
  return r.json();
}

async function holeGithubInfo(a) {
  const repo = repoPfad(a);
  if (!repo) return;
  const meta = await githubApi(`/repos/${repo}`);
  const commits = await githubApi(`/repos/${repo}/commits?per_page=1`).catch(() => null);
  const runs = await githubApi(`/repos/${repo}/actions/runs?per_page=1`).catch(() => null);
  const c = commits && commits[0];
  const lauf = runs && runs.workflow_runs && runs.workflow_runs[0];
  const info = {
    pushedAt: (meta.pushed_at || "").slice(0, 10),
    issues: meta.open_issues_count,
    commitMsg: c ? c.commit.message.split("\n")[0].slice(0, 80) : null,
    commitDatum: c ? (c.commit.author.date || "").slice(0, 10) : null,
    actions: lauf ? (lauf.conclusion || lauf.status) : null,
  };
  state.hosting[a.id] = Object.assign({}, state.hosting[a.id], { github: info, githubFehler: null });
  if (info.pushedAt) a.letzterPush = info.pushedAt; // Inventurfeld auffrischen
}

function findeVercelProjekt(a) {
  if (!vercelProjekte) return null;
  const sub = ((a.vercelUrl || "").match(/https?:\/\/([^.]+)\.vercel\.app/) || [])[1];
  const repoName = (repoPfad(a) || "").split("/")[1] || "";
  return vercelProjekte.find(p =>
    p.name === sub ||
    p.name === repoName.toLowerCase() ||
    (p.link && (p.link.repo || "").toLowerCase() === repoName.toLowerCase()));
}

async function holeVercelInfo(a) {
  const projekt = findeVercelProjekt(a);
  if (!projekt) {
    if (a.vercelUrl || repoPfad(a)) state.hosting[a.id] = Object.assign({}, state.hosting[a.id], { vercel: { keinProjekt: true }, vercelFehler: null });
    return;
  }
  const d = await vercelApi(`/v6/deployments?projectId=${projekt.id}&limit=1`);
  const dep = d.deployments && d.deployments[0];
  const info = {
    projekt: projekt.name,
    status: dep ? dep.state : "KEIN_DEPLOYMENT", // READY | ERROR | BUILDING | QUEUED | CANCELED
    datum: dep ? new Date(dep.createdAt).toLocaleDateString("de-DE") : null,
    url: dep ? "https://" + dep.url : null,
  };
  state.hosting[a.id] = Object.assign({}, state.hosting[a.id], { vercel: info, vercelFehler: null });
  if (!a.vercelUrl) { a.vercelUrl = `https://${projekt.name}.vercel.app`; }
  if (info.status === "READY") a.vercelBestaetigt = true;
}

async function aktualisiereHosting() {
  if (hostingLaeuft) return;
  hostingLaeuft = true;
  render();
  // Vercel-Projektliste einmal je Abruf holen
  if (state.einstellungen.vercelToken) {
    try {
      const d = await vercelApi("/v9/projects?limit=100");
      vercelProjekte = d.projects || [];
    } catch (e) {
      vercelProjekte = null;
      state.hostingVercelFehler = e.message;
    }
  }
  for (const a of state.apps) {
    if (repoPfad(a)) {
      try { await holeGithubInfo(a); }
      catch (e) { state.hosting[a.id] = Object.assign({}, state.hosting[a.id], { githubFehler: e.message }); }
    }
    if (state.einstellungen.vercelToken && vercelProjekte) {
      try { await holeVercelInfo(a); }
      catch (e) { state.hosting[a.id] = Object.assign({}, state.hosting[a.id], { vercelFehler: e.message }); }
    }
    render(); // Zeile für Zeile sichtbar aktualisieren
  }
  state.hostingZeit = new Date().toLocaleString("de-DE");
  hostingLaeuft = false;
  speichere();
  render();
}

function speichereTokens(ev) {
  ev.preventDefault();
  state.einstellungen.githubToken = ev.target.gh.value.trim();
  state.einstellungen.vercelToken = ev.target.vc.value.trim();
  state.hostingVercelFehler = null;
  speichere();
  render();
}

function actionsSymbol(status) {
  if (!status) return "–";
  const s = { success: "✅", failure: "❌", cancelled: "⛔", in_progress: "🔄", queued: "⏳" }[status] || status;
  return `<span title="Letzter GitHub-Actions-Lauf: ${esc(status)}">${s}</span>`;
}

function vercelStatusHtml(v) {
  if (!v) return "";
  if (v.keinProjekt) return '<small class="hinweis" style="margin:0">kein Vercel-Projekt gefunden</small>';
  const farbe = { READY: "gruen", ERROR: "rot", BUILDING: "gelb", QUEUED: "gelb", CANCELED: "grau" }[v.status] || "grau";
  return `<span class="ampel ${farbe}">●</span> ${esc(v.status)}${v.datum ? ` <small>(${esc(v.datum)})</small>` : ""}`;
}

/* ---------- App-Analyse (Register mit Detailblick je App) ---------- */

let analyseAppId = null;
const perfLive = {}; // appId -> {laeuft|ms|fehler} – nur im Speicher

function waehleAnalyseApp(id) { analyseAppId = id; render(); }

async function messeLadezeit(id) {
  const a = state.apps.find(x => x.id === id);
  if (!a) return;
  const url = a.lokalUrl || a.vercelUrl;
  if (!url) { perfLive[id] = { fehler: "keine URL hinterlegt" }; render(); return; }
  perfLive[id] = { laeuft: true };
  render();
  try {
    const zeiten = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(10000) });
      zeiten.push(Math.round(performance.now() - t0));
    }
    perfLive[id] = { ms: Math.min(...zeiten), url, zeit: new Date().toLocaleTimeString("de-DE") };
  } catch (e) {
    perfLive[id] = { fehler: "nicht erreichbar – im Heimnetz bzw. lokal geöffnetem Dashboard messen" };
  }
  render();
}

function analyseDetail(a) {
  const pc = state.pcs.find(p => p.id === a.rechner);
  const score = appScore(a);
  const b = a.bewertung || {};
  const p = a.performance;
  const live = perfLive[a.id];
  const links = [];
  if (a.vercelUrl) links.push(`<a class="knopf" href="${esc(a.vercelUrl)}" target="_blank" rel="noopener">▶ Öffnen (Vercel)</a>`);
  if (a.lokalUrl) links.push(`<a class="knopf" href="${esc(a.lokalUrl)}" target="_blank" rel="noopener">🖥 Öffnen (lokal)</a>`);
  if (a.github) links.push(`<a class="knopf" href="${esc(a.github)}" target="_blank" rel="noopener">GitHub${a.visibility === "private" ? " 🔒" : ""}</a>`);
  if (a.doku && a.doku.url) links.push(`<a class="knopf" href="${esc(a.doku.url)}" target="_blank" rel="noopener">📖 Doku</a>`);

  const steckbrief = [
    ["Status", esc(a.status || "aktiv")],
    ["Gebaut mit", (a.ursprung || []).join(", ") || "unbekannt"],
    ["Rechner (PC)", pc ? esc(pc.name) : "nicht zugeordnet"],
    ["GitHub", a.github ? `${esc(a.github.replace("https://github.com/", ""))} (${a.visibility === "private" ? "privat 🔒" : "öffentlich 🌐"})` : "–"],
    ["Vercel", a.vercelUrl ? esc(a.vercelUrl.replace("https://", "")) + (a.vercelBestaetigt ? " ✓" : " (vermutet)") : "–"],
    ["Gestartet", esc(a.gestartet || "–") + (a.gestartet ? " (erster Commit)" : "")],
    ["Letzte Änderung", esc(a.letzterPush || "–")],
    ["Umfang", a.umfang && a.umfang.loc ? `${a.umfang.dateien} Dateien · ${a.umfang.loc.toLocaleString("de-DE")} Zeilen` : "–"],
    ["Stack", (a.stack || []).join(", ") || "–"],
    ["Tags", (a.tags || []).map(t => "#" + t).join(" ") || "–"],
  ];

  const TECHNIK_ZEILEN = [["Frontend", "frontend"], ["Middleware", "middleware"], ["LLM-Modell", "llm"], ["Backend", "backend"]];

  return `<div class="karte analyse-detail">
    <div class="karte-kopf">
      <h2 style="margin:0">${esc(a.name)}</h2>
      <span style="white-space:nowrap">
        <button class="mini" onclick="bearbeiteBewertung('${a.id}')" title="Bewerten">★</button>
        <button class="mini" onclick="bearbeiteApp('${a.id}')" title="Bearbeiten">✎</button>
      </span>
    </div>
    <div class="badges">${(a.ursprung || []).map(u => `<span class="badge u-${esc(u.toLowerCase())}">${esc(u)}</span>`).join("")}
      ${score != null ? `<span class="badge score-badge">★ ${score.toFixed(1)}</span>` : ""}
      ${(a.status || "aktiv") !== "aktiv" ? `<span class="badge offen">${esc(a.status)}</span>` : ""}</div>
    ${a.beschreibung ? `<p>${esc(a.beschreibung)}</p>` : ""}
    <div class="aktionen">${links.join("")}</div>
    ${a.screenshot ? `<img class="shot" style="aspect-ratio:auto" src="${esc(a.screenshot)}" alt="Screenshot ${esc(a.name)}" onclick="zeigeShot('${a.id}')" title="Klicken zum Vergrößern">` : '<p class="leer">Kein Screenshot – App liegt (noch) nicht lauffähig auf GitHub.</p>'}

    <h3>📇 Steckbrief</h3>
    <table class="steckbrief">${steckbrief.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>

    <h3>🧱 Technologie</h3>
    ${a.technik ? `<table class="steckbrief">${TECHNIK_ZEILEN.map(([label, key]) =>
      `<tr><th>${label}</th><td>${esc(a.technik[key] || "–")}</td></tr>`).join("")}</table>`
    : '<p class="leer">nicht erfasst</p>'}

    <h3>📖 Dokumentation</h3>
    <p>${a.doku ? `${esc(a.doku.text)}${a.doku.url ? ` – <a href="${esc(a.doku.url)}" target="_blank" rel="noopener">öffnen</a>` : ""}` : '<span class="leer">nicht erfasst</span>'}</p>

    <h3>🔬 Analyse (Code-Inventur 15.07.2026)</h3>
    <p>${a.analyse ? esc(a.analyse) : '<span class="leer">noch keine Analyse – Code liegt nicht auf GitHub</span>'}</p>
    ${score != null ? `<p class="hinweis">Bewertung: ${KRITERIEN.map(k => b[k.key] ? `${k.label} ${b[k.key]}★` : "").filter(Boolean).join(" · ")}${b.notiz ? `<br>${esc(b.notiz)}` : ""}</p>` : ""}

    <h3>⏱ Performance</h3>
    ${p ? `<div class="perfzeile"><span class="stat"><b>${p.ladezeitMs >= 1000 ? (p.ladezeitMs / 1000).toFixed(1) + " s" : p.ladezeitMs + " ms"}</b><span>Ladezeit (gemessen)</span></span>
      <span class="stat"><b>${p.groesseKB >= 1024 ? (p.groesseKB / 1024).toFixed(1) + " MB" : p.groesseKB + " KB"}</b><span>Größe</span></span></div>
      <p class="hinweis">${esc(p.hinweis || "")} · Messung: Headless Chromium, 15.07.2026</p>`
    : '<p class="leer">keine Messung möglich (kein lauffähiger Code auf GitHub)</p>'}
    <p><button class="knopf" onclick="messeLadezeit('${a.id}')"${live && live.laeuft ? " disabled" : ""}>${live && live.laeuft ? "🔄 misst …" : "⏱ Ladezeit jetzt von hier messen"}</button>
      ${live && live.ms != null ? `<b class="score">${live.ms} ms</b> <small class="hinweis">(${esc(live.url)}, ${esc(live.zeit)}, Bestwert aus 3 Messungen)</small>` : ""}
      ${live && live.fehler ? `<span class="fehltext">${esc(live.fehler)}</span>` : ""}</p>

    <h3>💡 Verbesserungsvorschläge</h3>
    ${a.vorschlaege && a.vorschlaege.length ? `<ul class="vorschlaege">${a.vorschlaege.map(v => `<li>${esc(v)}</li>`).join("")}</ul>` : '<p class="leer">keine erfasst</p>'}
  </div>`;
}

function renderAnalyse() {
  if (!analyseAppId || !state.apps.some(a => a.id === analyseAppId)) analyseAppId = (state.apps[0] || {}).id;
  const a = state.apps.find(x => x.id === analyseAppId);
  return `${statistikZeile()}
  <h2>App-Analyse</h2>
  <p class="hinweis">Links eine App wählen – rechts Stand, Links, Screenshot, Doku, Analyse, Performance und Vorschläge.</p>
  <div class="analyse-raster">
    <div class="analyse-liste">
      ${state.apps.map(x => {
        const s = appScore(x);
        return `<button class="analyse-eintrag${x.id === analyseAppId ? " aktiv" : ""}" onclick="waehleAnalyseApp('${x.id}')">
          <b>${esc(x.name)}</b><br>
          <small>${(x.ursprung || []).join(", ") || "Werkzeug?"}${s != null ? ` · ★ ${s.toFixed(1)}` : ""}${x.performance ? "" : " · ⚠ kein Code"}</small>
        </button>`;
      }).join("")}
    </div>
    ${a ? analyseDetail(a) : ""}
  </div>`;
}

/* ---------- Bewertungs-/Vergleichsansicht ---------- */

const bewertungSort = { feld: "score", auf: false };

function sortiereBewertung(feld) {
  if (bewertungSort.feld === feld) bewertungSort.auf = !bewertungSort.auf;
  else { bewertungSort.feld = feld; bewertungSort.auf = feld === "name"; }
  render();
}

function renderBewertung() {
  const wert = (a, feld) => {
    if (feld === "name") return a.name.toLowerCase();
    if (feld === "score") return appScore(a) ?? -1;
    return (a.bewertung || {})[feld] || 0;
  };
  const apps = [...state.apps].sort((x, y) => {
    const a = wert(x, bewertungSort.feld), b = wert(y, bewertungSort.feld);
    return (a < b ? -1 : a > b ? 1 : 0) * (bewertungSort.auf ? 1 : -1);
  });
  const pfeil = feld => bewertungSort.feld === feld ? (bewertungSort.auf ? " ↑" : " ↓") : "";
  const zeilen = apps.map(a => {
    const score = appScore(a);
    const b = a.bewertung || {};
    return `<tr>
      <td><b>${esc(a.name)}</b>${b.notiz ? `<br><small class="hinweis" style="margin:0">${esc(b.notiz)}</small>` : ""}</td>
      ${KRITERIEN.map(k => `<td>${sterne(b[k.key])}</td>`).join("")}
      <td>${score != null ? `<b class="score">${score.toFixed(1)}</b>` : '<span class="leer">–</span>'}</td>
      <td><button class="mini" onclick="bearbeiteBewertung('${a.id}')" title="Bewerten">★</button></td>
    </tr>`;
  }).join("");

  // Statistik: Apps und Ø-Score je Werkzeug
  const jeWerkzeug = URSPRUENGE.map(u => {
    const passend = state.apps.filter(a => (a.ursprung || []).includes(u));
    const scores = passend.map(appScore).filter(s => s != null);
    return { u, anzahl: passend.length, schnitt: scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null };
  }).filter(g => g.anzahl);
  const maxAnzahl = Math.max(1, ...jeWerkzeug.map(g => g.anzahl));
  const bewertet = state.apps.filter(a => appScore(a) != null);
  const beste = [...bewertet].sort((x, y) => appScore(y) - appScore(x)).slice(0, 3);

  return `${statistikZeile()}
  <h2>Bewertung &amp; Vergleich</h2>
  <p class="hinweis">Spaltenkopf anklicken zum Sortieren · ★ öffnet den Bewertungs-Editor. Die vorbefüllten Werte sind
  <b>Vorschläge aus der Code-Analyse</b> (siehe Notiz) – „Nutzen" kannst nur du vergeben.</p>
  <div class="tabellenrahmen"><table class="bewertungstabelle">
    <thead><tr>
      <th onclick="sortiereBewertung('name')" style="cursor:pointer">App${pfeil("name")}</th>
      ${KRITERIEN.map(k => `<th onclick="sortiereBewertung('${k.key}')" style="cursor:pointer" title="${k.hilfe}">${k.label}${pfeil(k.key)}</th>`).join("")}
      <th onclick="sortiereBewertung('score')" style="cursor:pointer">Score${pfeil("score")}</th>
      <th></th>
    </tr></thead>
    <tbody>${zeilen}</tbody>
  </table></div>

  <div class="zweispaltig" style="margin-top:1.2rem; align-items:start">
    <div class="karte">
      <h3>Apps je Werkzeug</h3>
      ${jeWerkzeug.map(g => `<div class="balkenzeile">
        <span class="balkenname">${esc(g.u)}</span>
        <div class="balkenbahn"><div class="balken" style="width:${Math.round(g.anzahl / maxAnzahl * 100)}%"></div></div>
        <span class="balkenwert">${g.anzahl}${g.schnitt != null ? ` · Ø ${g.schnitt.toFixed(1)}` : ""}</span>
      </div>`).join("") || '<p class="leer">noch keine Zuordnungen</p>'}
      <p class="hinweis">${state.apps.filter(a => !(a.ursprung || []).length).length} App(s) ohne Werkzeug-Zuordnung</p>
    </div>
    <div class="karte">
      <h3>Top 3 (Gesamt-Score)</h3>
      ${beste.map((a, i) => `<div class="balkenzeile">
        <span class="balkenname">${["🥇", "🥈", "🥉"][i]} ${esc(a.name)}</span>
        <div class="balkenbahn"><div class="balken gold" style="width:${Math.round(appScore(a) / 5 * 100)}%"></div></div>
        <span class="balkenwert">${appScore(a).toFixed(1)}</span>
      </div>`).join("") || '<p class="leer">noch nichts bewertet</p>'}
      <p class="hinweis">${bewertet.length} von ${state.apps.length} Apps bewertet</p>
    </div>
  </div>`;
}

function renderDaten() {
  return `<h2>Daten</h2>
  <p class="hinweis">Alle Änderungen liegen im LocalStorage dieses Browsers. Per Export sicherst du sie als JSON
  (z. B. um sie ins Repo zu übernehmen oder auf einen anderen Rechner mitzunehmen).</p>
  <div class="aktionen">
    <button class="knopf primär" onclick="exportiereJson()">⬇ JSON exportieren</button>
    <label class="knopf">⬆ JSON importieren<input type="file" accept=".json" hidden onchange="importiereJson(this)"></label>
    <button class="knopf gefahr" onclick="if(confirm('Alle lokalen Änderungen verwerfen und auf Startdaten zurücksetzen?')){localStorage.removeItem(STORAGE_KEY);location.reload()}">Zurücksetzen</button>
  </div>`;
}

/* ---------- Formulare (Modal) ---------- */

function zeigeModal(html, klasse) { $("#modal").innerHTML = `<div class="modal-box${klasse ? " " + klasse : ""}">${html}</div>`; $("#modal").classList.add("offen"); }
function schliesseModal() { $("#modal").classList.remove("offen"); $("#modal").innerHTML = ""; }

function bearbeiteApp(id) {
  const a = id ? state.apps.find(x => x.id === id) : {
    id: "", name: "", beschreibung: "", ursprung: [], stack: [], rechner: "",
    github: "", vercelUrl: "", lokalUrl: "", tags: [], status: "aktiv",
  };
  if (!a) return;
  const uBoxen = URSPRUENGE.map(u =>
    `<label class="checkchip"><input type="checkbox" name="ursprung" value="${u}"${(a.ursprung || []).includes(u) ? " checked" : ""}>${u}</label>`).join("");
  const optR = state.pcs.map(p => `<option value="${p.id}"${a.rechner === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  zeigeModal(`<h3>${id ? "App bearbeiten" : "Neue App"}</h3>
  <form onsubmit="speichereApp(event,'${id || ""}')">
    <label>Name<input name="name" required value="${esc(a.name)}"></label>
    <label>Beschreibung<textarea name="beschreibung" rows="2">${esc(a.beschreibung)}</textarea></label>
    <label>Gebaut mit (Werkzeug)</label><div class="checkchips">${uBoxen}</div>
    <div class="zweispaltig">
      <label>Rechner<select name="rechner"><option value="">–</option>${optR}</select></label>
      <label>Status<select name="status">${["aktiv", "pausiert", "archiviert"].map(s => `<option${(a.status || "aktiv") === s ? " selected" : ""}>${s}</option>`).join("")}</select></label>
    </div>
    <label>Stack (Komma-getrennt)<input name="stack" value="${esc((a.stack || []).join(", "))}"></label>
    <label>Tags (Komma-getrennt)<input name="tags" value="${esc((a.tags || []).join(", "))}"></label>
    <label>GitHub-URL<input name="github" type="url" value="${esc(a.github)}"></label>
    <label>Vercel-URL<input name="vercelUrl" type="url" value="${esc(a.vercelUrl)}"></label>
    <label>Lokale URL (http://rechner:port)<input name="lokalUrl" value="${esc(a.lokalUrl)}"></label>
    <div class="aktionen">
      <button class="knopf primär" type="submit">Speichern</button>
      <button class="knopf" type="button" onclick="schliesseModal()">Abbrechen</button>
      ${id ? `<button class="knopf gefahr" type="button" onclick="loescheApp('${id}')">Löschen</button>` : ""}
    </div>
  </form>`);
}

function speichereApp(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const liste = v => v.split(",").map(x => x.trim()).filter(Boolean);
  const daten = {
    name: f.name.value.trim(),
    beschreibung: f.beschreibung.value.trim(),
    ursprung: [...f.querySelectorAll('input[name="ursprung"]:checked')].map(x => x.value),
    rechner: f.rechner.value,
    status: f.status.value,
    stack: liste(f.stack.value),
    tags: liste(f.tags.value),
    github: f.github.value.trim(),
    vercelUrl: f.vercelUrl.value.trim(),
    lokalUrl: f.lokalUrl.value.trim(),
  };
  if (id) {
    Object.assign(state.apps.find(x => x.id === id), daten);
  } else {
    state.apps.push(Object.assign({ id: neueId(daten.name) }, daten));
  }
  speichere(); schliesseModal(); render();
}

function loescheApp(id) {
  if (!confirm("Diese App aus der Übersicht löschen?")) return;
  state.apps = state.apps.filter(a => a.id !== id);
  speichere(); schliesseModal(); render();
}

function bearbeitePc(id) {
  const pc = id ? state.pcs.find(p => p.id === id) : { id: "", name: "", os: "", ort: "", notiz: "", agentUrl: "", agentToken: "" };
  if (!pc) return;
  zeigeModal(`<h3>${id ? "Rechner bearbeiten" : "Neuer Rechner"}</h3>
  <form onsubmit="speicherePc(event,'${id || ""}')">
    <label>Name<input name="name" required value="${esc(pc.name)}"></label>
    <div class="zweispaltig">
      <label>Betriebssystem<input name="os" value="${esc(pc.os)}"></label>
      <label>Standort<input name="ort" value="${esc(pc.ort)}"></label>
    </div>
    <div class="zweispaltig">
      <label>Agent-Adresse (WLAN)<input name="agentUrl" placeholder="http://192.168.178.23:9800" value="${esc(pc.agentUrl || "")}"></label>
      <label>Agent-Token<input name="agentToken" type="password" value="${esc(pc.agentToken || "")}"></label>
    </div>
    <label>Notiz<textarea name="notiz" rows="2">${esc(pc.notiz)}</textarea></label>
    <div class="aktionen">
      <button class="knopf primär" type="submit">Speichern</button>
      <button class="knopf" type="button" onclick="schliesseModal()">Abbrechen</button>
      ${id ? `<button class="knopf gefahr" type="button" onclick="loeschePc('${id}')">Löschen</button>` : ""}
    </div>
  </form>`);
}

function speicherePc(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const daten = { name: f.name.value.trim(), os: f.os.value.trim(), ort: f.ort.value.trim(), notiz: f.notiz.value.trim(),
    agentUrl: f.agentUrl.value.trim(), agentToken: f.agentToken.value };
  if (id) Object.assign(state.pcs.find(p => p.id === id), daten);
  else {
    let nid = "pc" + (state.pcs.length + 1), n = state.pcs.length + 1;
    while (state.pcs.some(p => p.id === nid)) nid = "pc" + ++n;
    state.pcs.push(Object.assign({ id: nid }, daten));
  }
  speichere(); schliesseModal(); render();
}

function loeschePc(id) {
  if (!confirm("Rechner löschen? Zugeordnete Apps bleiben erhalten (ohne Rechner).")) return;
  state.pcs = state.pcs.filter(p => p.id !== id);
  state.apps.forEach(a => { if (a.rechner === id) a.rechner = ""; });
  speichere(); schliesseModal(); render();
}

function zeigeShot(id) {
  const a = state.apps.find(x => x.id === id);
  if (!a || !a.screenshot) return;
  zeigeModal(`<h3>${esc(a.name)}</h3>
    <img class="shot-gross" src="${esc(a.screenshot)}" alt="Screenshot ${esc(a.name)}">
    <p class="hinweis">${esc(a.beschreibung || "")}</p>
    <div class="aktionen"><button class="knopf" onclick="schliesseModal()">Schließen</button></div>`, "breit");
}

/* ---------- Aktionen ---------- */

function pruefeAppId(id) {
  const a = state.apps.find(x => x.id === id);
  if (a) pruefeApp(a);
}

async function pruefeAlle() {
  for (const a of state.apps) await pruefeApp(a);
}

function exportiereJson() {
  const blob = new Blob([JSON.stringify({ apps: state.apps, pcs: state.pcs }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "homelab-apps.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importiereJson(input) {
  const datei = input.files[0];
  if (!datei) return;
  datei.text().then(txt => {
    const d = JSON.parse(txt);
    if (!Array.isArray(d.apps)) throw new Error("apps fehlt");
    state.apps = d.apps;
    if (Array.isArray(d.pcs)) state.pcs = d.pcs;
    speichere(); render();
    alert("Import erfolgreich: " + state.apps.length + " Apps.");
  }).catch(e => alert("Import fehlgeschlagen: " + e.message));
}

/* ---------- Start ---------- */

$("#modal").addEventListener("click", ev => { if (ev.target.id === "modal") schliesseModal(); });
render();
