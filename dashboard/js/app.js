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
      ["umfang", "screenshot", "letzterPush", "visibility", "vercelBestaetigt"].forEach(f => {
        if (seed[f] !== undefined) alt[f] = strukturKopie(seed[f]);
      });
    });
    s.seedVersion = SEED_VERSION;
  }
  if (!Array.isArray(s.pcs) || !s.pcs.length) s.pcs = strukturKopie(SEED_PCS);
  if (!s.checks) s.checks = {};
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
      <button class="mini" onclick="bearbeiteApp('${a.id}')" title="Bearbeiten">✎</button>
    </div>
    <div class="badges">${urspruenge}${(a.status || "aktiv") !== "aktiv" ? `<span class="badge offen">${esc(a.status)}</span>` : ""}</div>
    ${a.beschreibung ? `<p>${esc(a.beschreibung)}</p>` : '<p class="leer">Keine Beschreibung – ✎ klicken und ergänzen.</p>'}
    <div class="meta">
      ${a.rechner ? `<span>🖥 ${esc(pcName(a.rechner))}</span>` : '<span class="leer">Rechner?</span>'}
      ${a.letzterPush ? `<span>Push: ${esc(a.letzterPush)}</span>` : ""}
      ${a.umfang && a.umfang.loc ? `<span>${a.umfang.dateien} Dateien · ${a.umfang.loc.toLocaleString("de-DE")} Zeilen</span>` : ""}
    </div>
    ${stack || tags ? `<div class="chips">${stack}${tags}</div>` : ""}
    <div class="aktionen">${links.join("")}
      <button class="knopf" onclick="pruefeAppId('${a.id}')" title="Erreichbarkeit prüfen">⟳ Status</button>
    </div>
  </div>`;
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
  <p class="hinweis">Namen und Details über ✎ pflegen; Apps werden über das App-Formular einem Rechner zugeordnet.</p>
  <div class="raster pc-raster">
    ${state.pcs.map(pc => {
      const apps = state.apps.filter(a => a.rechner === pc.id);
      return `<div class="karte pc">
        <div class="karte-kopf"><h3>🖥 ${esc(pc.name)}</h3>
          <button class="mini" onclick="bearbeitePc('${pc.id}')" title="Bearbeiten">✎</button></div>
        <div class="meta">${pc.os ? `<span>${esc(pc.os)}</span>` : ""}${pc.ort ? `<span>${esc(pc.ort)}</span>` : ""}</div>
        ${pc.notiz ? `<p>${esc(pc.notiz)}</p>` : ""}
        <p class="hinweis">${apps.length} App(s)</p>
        <ul class="appliste">${apps.map(a => `<li><a href="#uebersicht" onclick="filter.text='${esc(a.name)}'">${esc(a.name)}</a></li>`).join("") || "<li class='leer'>keine zugeordnet</li>"}</ul>
      </div>`;
    }).join("")}
  </div>
  <button class="knopf" onclick="bearbeitePc(null)">＋ Rechner</button>
  <h3 style="margin-top:1.5rem">Noch keinem Rechner zugeordnet</h3>
  <ul class="appliste">${state.apps.filter(a => !a.rechner).map(a => `<li>${esc(a.name)} <button class="mini" onclick="bearbeiteApp('${a.id}')">✎</button></li>`).join("") || "<li class='leer'>alle zugeordnet 🎉</li>"}</ul>`;
}

function renderHosting() {
  const zeilen = state.apps.map(a => `<tr>
    <td><b>${esc(a.name)}</b></td>
    <td>${a.github ? `<a href="${esc(a.github)}" target="_blank" rel="noopener">${esc(a.github.replace("https://github.com/", ""))}</a> ${a.visibility === "private" ? "🔒" : "🌐"}` : "–"}</td>
    <td>${esc(a.letzterPush || "–")}</td>
    <td>${a.vercelUrl ? `${checkBadge(a, "vercel")} <a href="${esc(a.vercelUrl)}" target="_blank" rel="noopener">${esc(a.vercelUrl.replace("https://", ""))}</a>${a.vercelBestaetigt || (state.checks[a.id + ":vercel"] || {}).status === "ok" ? "" : " <small>(vermutet)</small>"}` : "–"}</td>
    <td>${a.lokalUrl ? `${checkBadge(a, "lokal")} <a href="${esc(a.lokalUrl)}" target="_blank" rel="noopener">${esc(a.lokalUrl)}</a>` : "–"}</td>
    <td><button class="mini" onclick="pruefeAppId('${a.id}')" title="Erreichbarkeit prüfen">⟳</button></td>
  </tr>`).join("");
  return `${statistikZeile()}
  <h2>GitHub &amp; Vercel</h2>
  <p class="hinweis">Vercel-URLs nach dem Schema <code>&lt;projekt&gt;.vercel.app</code> sind <b>vermutet</b>, bis eine Prüfung
  sie bestätigt (grüner Punkt). Die Prüfung läuft direkt in deinem Browser – im Heimnetz erreicht sie auch lokale Apps.</p>
  <p><button class="knopf primär" onclick="pruefeAlle()">⟳ Alle prüfen</button></p>
  <div class="tabellenrahmen"><table>
    <thead><tr><th>App</th><th>GitHub-Repo</th><th>Letzter Push</th><th>Vercel</th><th>Lokal</th><th></th></tr></thead>
    <tbody>${zeilen}</tbody>
  </table></div>`;
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
  const pc = id ? state.pcs.find(p => p.id === id) : { id: "", name: "", os: "", ort: "", notiz: "" };
  if (!pc) return;
  zeigeModal(`<h3>${id ? "Rechner bearbeiten" : "Neuer Rechner"}</h3>
  <form onsubmit="speicherePc(event,'${id || ""}')">
    <label>Name<input name="name" required value="${esc(pc.name)}"></label>
    <div class="zweispaltig">
      <label>Betriebssystem<input name="os" value="${esc(pc.os)}"></label>
      <label>Standort<input name="ort" value="${esc(pc.ort)}"></label>
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
  const daten = { name: f.name.value.trim(), os: f.os.value.trim(), ort: f.ort.value.trim(), notiz: f.notiz.value.trim() };
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
