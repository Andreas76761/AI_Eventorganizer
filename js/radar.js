// Insight Radar: Trend-Radar je Veranstaltung (Format trendradar-export/1).
// Portiert aus dem "Event Insight Radar"-Viewer (playground-2.aicelerator.io, 21.11.2026)
// und in die App integriert: Start mit Event-Auswahl, Datensätze aus data/ oder
// per Import (JSON-Export oder generierte Viewer-HTML); Importe liegen in IndexedDB.

const RADAR_QUELLEN = [
  { id: "aiw26", url: "data/radar-aiw26.json", name: "AI Week Frankfurt 2026", termin: "26.–30.10.2026", ort: "Frankfurt", info: "115 Sessions · 1.053 Signale · 13 Makro- / 91 Mikrotrends", stand: "06.11.2026" }
];

// Event-Archive: Programm, Transkripte, Speaker, Aussteller – nach Jahren getrennt (recherchiert 26.11.2026)
const ARCHIV_QUELLEN = [
  { id: "aiw", url: "data/aiw-archiv.json", name: "AI Week Frankfurt – Archiv", zeitraum: "2024 · 2025 · 2026", info: "Programm mit Transkript-Links (124 Talks 2026), 178 Speaker, 22 Aussteller mit Ständen, Workshops, Fotos & Recaps" },
  { id: "wad", url: "data/wad-archiv.json", name: "WeAreDevelopers World Congress – Archiv", zeitraum: "2024 · 2025 · 2026", info: "241 Sessions und 270 Speaker (2026) aus der Agenda, Keynotes, After-Movies & Recaps der Vorjahre", eventIds: { 2026: "ev_wad26" } },
  { id: "e9", url: "data/e9-archiv.json", name: "1E9 – Festival der Zukunft – Archiv", zeitraum: "2025 · 2026", info: "284 Programmpunkte mit Inhaltsbeschreibung, 313 Speaker mit Bio und 254 Firmen (2026); Motto, Speaker & Quellen 2025", eventIds: { 2026: "ev_1e9_26" } },
  { id: "dup", url: "data/dup-archiv.json", name: "data:unplugged – Archiv", zeitraum: "2025 · 2026", info: "2026: 10.000+ Teilnehmende, 200+ Speaker (u. a. Hoeneß, Lanz, DeepL), 150+ Aussteller; 2025 im Skaters Palace", eventIds: { 2026: "ev_dup26" } },
  { id: "roai", url: "data/roai-archiv.json", name: "Rise of AI Conference – Archiv", zeitraum: "2025 · 2026", info: "10. Ausgabe 2026 im Humboldt Carré (Meta + Applied AI Stage); 2025 „Good news from Europe“ mit Wissing", eventIds: { 2026: "ev_roai26" } },
  { id: "bdaiw", url: "data/bdaiw-archiv.json", name: "Big Data & AI World Frankfurt – Archiv", zeitraum: "2025 · 2026", info: "Tech Show Frankfurt: 150+ Sessions auf 7 Bühnen, BARC-Keynotes, Speaker-Verzeichnis; 2025 mit 7.000+ Besuchern", eventIds: { 2026: "ev_bdaiw26" } },
  { id: "aidaq", url: "data/aidaq-archiv.json", name: "AIDAQ (Bitkom) – Archiv", zeitraum: "2025 · 2026", info: "2026: 2.500+ Teilnehmer, 220 Speaker, 140 Sessions, Keynote Dorothee Bär, Schirmherrschaft BMFTR", eventIds: { 2026: "ev_bdai26" } },
  { id: "bp", url: "data/bp-archiv.json", name: "Bits & Pretzels – Archiv", zeitraum: "2025 · 2026", info: "2026 „Human after all“ mit Trevor Noah & Steven Bartlett; 2025 „Connecting Europe“ mit 21.000 Investorengesprächen", eventIds: { 2026: "ev_bp26" } }
];

const RADAR = (function () {
  "use strict";

  let ROOT = null;        // #ir-wrap der aktuellen Ansicht
  let DATA = null;        // geöffneter Radar-Datensatz
  let ARCHIV = null;      // geöffnetes Event-Archiv
  let aktiveQuelle = "";  // Beschriftung der Quelle (für Zurück-Leiste)
  const cacheQuellen = {}; // gefetchte Built-in-Datensätze
  const archivZustand = { jahr: null, bereich: "programm", q: "" };

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  const $ = s => ROOT ? ROOT.querySelector(s) : null;
  const $$ = s => ROOT ? Array.from(ROOT.querySelectorAll(s)) : [];
  const KONFIG = { produktname: "Event Insight Radar" };

  function irToast(t) {
    let e = document.getElementById("irToastEl");
    if (!e) { e = document.createElement("div"); e.id = "irToastEl"; e.className = "ir-toast"; e.setAttribute("role", "status"); document.body.appendChild(e); }
    e.textContent = t; e.classList.add("show");
    clearTimeout(irToast.t); irToast.t = setTimeout(() => e.classList.remove("show"), 2600);
  }
  function istDunkel() {
    const t = localStorage.getItem("aimg2026_theme") || "neon";
    return t === "neon";
  }
  // Teilnahme-Status aus der App (Anmeldungen), z. B. "Besucht" = teilgenommen
  function teilnahmeChip(eventIds, jahr) {
    try {
      if (!eventIds || typeof statusVon !== "function" || typeof S === "undefined") return "";
      const eintraege = Object.entries(eventIds).filter(([j]) => !jahr || String(j) === String(jahr));
      return eintraege.map(([j, id]) => {
        if (!S.events.some(e => e.id === id)) return "";
        const st = statusVon(id);
        const txt = st === "Besucht" ? "teilgenommen ✓" : st === "Abgesagt" ? "nicht teilgenommen" : st;
        return `<span class="chip">${esc(j)}: ${esc(txt)}</span>`;
      }).join("");
    } catch (e) { return ""; }
  }

  /* ================= Startbildschirm: Event wählen ================= */

  async function init() {
    ROOT = document.getElementById("ir-wrap");
    if (!ROOT) return;
    ROOT.classList.toggle("dunkel", istDunkel());
    if (DATA) { startViewer(); return; }
    if (ARCHIV) { zeichneArchiv(); return; }
    let importe = [];
    try { importe = await dbFilesForEvent("__radar__", "radar"); } catch (e) { /* IDB nicht verfügbar */ }
    if (!ROOT.isConnected) return;
    ROOT.innerHTML = `<div class="wrap">
      <header class="top"><div>
        <div class="brand">Insight Radar</div>
        <h1>Event auswählen</h1>
        <p class="lede">Trend-Radar je Veranstaltung: Makro- und Mikrotrends, abgeleitet aus belegten Aussagen der Vorträge. Jede Aussage trägt Zitat, Fundstelle und Absender – inkl. Sessions, Speakern und Firmen/Ausstellern.</p>
      </div></header>
      <div class="startgrid">
        ${RADAR_QUELLEN.map(q => `<div class="startkarte">
          <h3>${esc(q.name)}</h3>
          <div class="meta">${esc(q.termin)} · ${esc(q.ort)} · Stand ${esc(q.stand)}</div>
          <p>${esc(q.info)}</p>
          <div class="aktion"><button class="btn" data-quelle="${esc(q.id)}">Radar öffnen</button></div>
        </div>`).join("")}
        ${ARCHIV_QUELLEN.map(q => `<div class="startkarte">
          <h3>${esc(q.name)}</h3>
          <div class="meta">${esc(q.zeitraum)}</div>
          <p>${esc(q.info)}</p>
          ${teilnahmeChip(q.eventIds) ? `<div class="chipline">${teilnahmeChip(q.eventIds)}</div>` : ""}
          <div class="aktion"><button class="btn" data-archiv="${esc(q.id)}">Archiv öffnen</button></div>
        </div>`).join("")}
        ${importe.map(r => `<div class="startkarte">
          <h3>${esc(r.name || r.id)}</h3>
          <div class="meta">Import · Stand ${esc((r.datum || "").slice(0, 10))}</div>
          <p>${esc(r.info || "Importierter Trendradar-Export")}</p>
          <div class="aktion"><button class="btn" data-import="${esc(r.id)}">Radar öffnen</button><button class="btn small" data-loesch="${esc(r.id)}">Entfernen</button></div>
        </div>`).join("")}
        <div class="startkarte">
          <h3>Export importieren</h3>
          <div class="meta">trendradar-export/1</div>
          <p>JSON-Export oder generierte Radar-HTML-Datei eines weiteren Events laden. Der Datensatz bleibt lokal in diesem Browser (IndexedDB).</p>
          <div class="aktion"><label class="btn">Datei wählen<input type="file" accept=".json,.html,.htm,application/json,text/html" style="display:none" id="irImportDatei"></label></div>
        </div>
      </div>
    </div>`;
    $$("[data-quelle]").forEach(b => b.addEventListener("click", () => oeffneQuelle(b.dataset.quelle)));
    $$("[data-archiv]").forEach(b => b.addEventListener("click", () => oeffneArchiv(b.dataset.archiv)));
    $$("[data-import]").forEach(b => b.addEventListener("click", () => oeffneImport(b.dataset.import)));
    $$("[data-loesch]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Diesen importierten Radar-Datensatz entfernen?")) return;
      await dbDeleteFile(b.dataset.loesch); irToast("Import entfernt"); init();
    }));
    const fi = ROOT.querySelector("#irImportDatei");
    if (fi) fi.addEventListener("change", () => importDatei(fi.files[0]));
  }

  async function oeffneQuelle(id) {
    const q = RADAR_QUELLEN.find(x => x.id === id); if (!q) return;
    try {
      if (!cacheQuellen[id]) {
        irToast("Lade Datensatz …");
        const resp = await fetch(q.url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        cacheQuellen[id] = await resp.json();
      }
      DATA = cacheQuellen[id]; aktiveQuelle = q.name;
      startViewer();
    } catch (e) { irToast("Datensatz konnte nicht geladen werden: " + e.message); }
  }

  async function oeffneImport(dbId) {
    try {
      const r = await dbGetFile(dbId); if (!r || !r.text) throw new Error("nicht gefunden");
      DATA = JSON.parse(r.text); aktiveQuelle = r.name || "Import";
      startViewer();
    } catch (e) { irToast("Import konnte nicht geöffnet werden: " + e.message); }
  }

  async function importDatei(file) {
    if (!file) return;
    try {
      let txt = await file.text(), json = txt.trim();
      if (json[0] === "<") { // generierte Viewer-HTML: DATA-Zeile extrahieren
        const z = txt.split("\n").find(l => l.startsWith("const DATA"));
        if (!z) throw new Error("keine DATA-Zeile in der HTML-Datei gefunden");
        json = z.slice(z.indexOf("{"), z.lastIndexOf("}") + 1);
      }
      const d = JSON.parse(json);
      if (!String(d.format || "").startsWith("trendradar-export")) throw new Error("kein trendradar-export");
      if (!d.makro || !d.signale || !d.sessions) throw new Error("unvollständiger Export");
      const id = "radar_" + (d.export_id || Date.now());
      await dbPutFile({
        id, eventId: "__radar__", typ: "radar", name: d.titel || d.export_id, datum: d.stand || "",
        info: `${d.sessions.length} Sessions · ${d.signale.length} Signale · ${d.makro.length} Makro- / ${(d.mikro || []).length} Mikrotrends`,
        text: JSON.stringify(d)
      });
      irToast("Import gespeichert: " + (d.titel || id));
      init();
    } catch (e) { irToast("Import fehlgeschlagen: " + e.message); }
  }

  function schliessen() { DATA = null; ARCHIV = null; aktiveQuelle = ""; init(); }

  /* ================= Event-Archiv (Programm, Transkripte, Speaker, Aussteller) ================= */

  async function oeffneArchiv(id) {
    const q = ARCHIV_QUELLEN.find(x => x.id === id); if (!q) return;
    try {
      if (!cacheQuellen["archiv_" + id]) {
        irToast("Lade Archiv …");
        const resp = await fetch(q.url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        cacheQuellen["archiv_" + id] = await resp.json();
      }
      ARCHIV = cacheQuellen["archiv_" + id]; aktiveQuelle = q.name;
      const jahre = ARCHIV.jahre.map(j => j.jahr).sort((a, b) => b - a);
      archivZustand.jahr = jahre[0]; archivZustand.bereich = "programm"; archivZustand.q = ""; archivZustand.quelleId = id;
      zeichneArchiv();
    } catch (e) { irToast("Archiv konnte nicht geladen werden: " + e.message); }
  }

  function zeichneArchiv() {
    const z = archivZustand;
    const jahre = ARCHIV.jahre.slice().sort((a, b) => b.jahr - a.jahr);
    const J = jahre.find(j => j.jahr === z.jahr) || jahre[0]; z.jahr = J.jahr;
    const q = z.q.trim().toLowerCase();
    const filt = (arr, felder) => !q ? arr : arr.filter(x => felder.some(f => String(x[f] || "").toLowerCase().includes(q)));
    const prog = filt(J.programm || [], ["titel", "speaker", "buehne", "track", "tag"]);
    const spk = filt(J.speaker || [], ["name", "firma", "position"]);
    const aus = filt(J.aussteller || [], ["name", "branche", "stand", "beschreibung"]);
    const ws = filt(J.workshops || [], ["titel", "untertitel", "raum", "tag"]);
    const bereiche = [["programm", `Programm (${prog.length})`, (J.programm || []).length],
      ["speaker", `Speaker (${spk.length})`, (J.speaker || []).length],
      ["aussteller", `Firmen & Aussteller (${aus.length})`, (J.aussteller || []).length],
      ["workshops", `Workshops (${ws.length})`, (J.workshops || []).length]].filter(b => b[2] > 0);
    if (bereiche.length && !bereiche.some(b => b[0] === z.bereich)) z.bereich = bereiche[0][0];
    const nTr = (J.programm || []).filter(p => p.transkript).length;

    const progHtml = () => `<div class="sess">${prog.map(p => `<div class="sessrow">
      <div class="t">${esc(p.titel)}</div>
      <div class="meta">${p.tag ? `<span class="chip">${esc(p.tag)}${p.start ? " · " + esc(p.start) + (p.ende ? "–" + esc(p.ende) : "") : ""}</span>` : ""}${p.buehne ? `<span>${esc(p.buehne)}</span>` : ""}${p.track ? `<span>${esc(p.track)}</span>` : ""}${p.format ? `<span class="flag">${esc(p.format)}</span>` : ""}</div>
      ${p.speaker ? `<div class="meta"><span>${esc(p.speaker)}</span></div>` : ""}
      ${p.inhalt ? `<div class="meta"><span>${esc(p.inhalt)}</span></div>` : ""}
      ${p.transkript ? `<div class="meta"><a class="chip" href="${esc(p.transkript)}" target="_blank" rel="noopener">▶ Transkript &amp; Summary ↗</a></div>` : ""}
    </div>`).join("") || `<p class="empty">Keine Treffer.</p>`}</div>`;

    const spkHtml = () => `<div class="firmen">${spk.map(s => `<div class="firma"><b>${esc(s.name)}</b>
      <small>${esc(s.position)}${s.firma ? (s.position ? " · " : "") + esc(s.firma) : ""}</small>
      ${s.bio ? `<small>${esc(s.bio)}</small>` : ""}
      ${s.linkedin ? `<div><a class="chip" href="${esc(s.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a></div>` : ""}
    </div>`).join("") || `<p class="empty">Keine Treffer.</p>`}</div>`;

    const ausHtml = () => `<div class="firmen">${aus.map(a => `<div class="firma"><b>${esc(a.name)}</b>
      <small>${a.stand ? "Stand " + esc(a.stand) : ""}${a.branche ? (a.stand ? " · " : "") + esc(a.branche) : ""}${a.tier ? " · " + esc(a.tier) : ""}</small>
      ${a.beschreibung ? `<small>${esc(a.beschreibung)}</small>` : ""}
      ${a.website ? `<div><a class="chip" href="${esc(a.website)}" target="_blank" rel="noopener">Website ↗</a></div>` : ""}
    </div>`).join("") || `<p class="empty">Keine Treffer.</p>`}</div>`;

    const wsHtml = () => `<div class="sess">${ws.map(w => `<div class="sessrow">
      <div class="t">${esc(w.titel)}</div>
      <div class="meta">${w.tag ? `<span class="chip">${esc(w.tag)}${w.start ? " · " + esc(w.start) + (w.ende ? "–" + esc(w.ende) : "") : ""}</span>` : ""}${w.raum ? `<span>${esc(w.raum)}</span>` : ""}</div>
      ${w.untertitel ? `<div class="meta"><span>${esc(w.untertitel)}</span></div>` : ""}
    </div>`).join("") || `<p class="empty">Keine Treffer.</p>`}</div>`;

    ROOT.innerHTML = `<div class="wrap">
      <div class="chipline" style="margin-bottom:10px"><button class="btn small" id="irZurueck">← Anderes Event wählen</button><span class="chip">${esc(aktiveQuelle)}</span><span class="chip">Stand ${esc(ARCHIV.stand || "")}</span></div>
      <header class="top"><div>
        <div class="brand">Event-Archiv</div>
        <h1>${esc(J.titel)}</h1>
        <div class="eyebrow"><span>${esc(J.termin)}</span><span>${esc(J.ort)}</span><span>${esc(J.veranstalter || "")}</span>${nTr ? `<span>${nTr} Vorträge mit Transkript</span>` : ""}</div>
        ${(() => { const qd = ARCHIV_QUELLEN.find(x => x.id === z.quelleId); const c = qd ? teilnahmeChip(qd.eventIds, J.jahr) : ""; return c ? `<div class="chipline" style="margin-top:6px"><span>Meine Teilnahme:</span>${c}</div>` : ""; })()}
      </div></header>
      <nav class="views" aria-label="Jahre">${jahre.map(j => `<button class="btn${j.jahr === z.jahr ? " on" : ""}" data-jahr="${j.jahr}">${j.jahr}</button>`).join("")}</nav>
      <div class="card" style="margin-bottom:18px">
        <div><h3>Eckdaten ${esc(String(J.jahr))}</h3><ul style="margin:0;padding-left:20px;display:grid;gap:3px">${(J.fakten || []).map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>
        ${(J.links || []).length ? `<div><h3>Unterlagen &amp; Quellen</h3><div class="related">${J.links.map(l => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join("")}</div></div>` : ""}
      </div>
      ${bereiche.length ? `<div class="bar"><span class="chipline">${bereiche.map(b => `<button class="btn small${z.bereich === b[0] ? " on" : ""}" data-bereich="${b[0]}">${esc(b[1])}</button>`).join("")}</span>
        <div class="grow"><input type="search" id="archivSuche" placeholder="Suchen (Titel, Speaker, Firma, Bühne) …" value="${esc(z.q)}"></div></div>
      <div class="card">${z.bereich === "programm" ? progHtml() : z.bereich === "speaker" ? spkHtml() : z.bereich === "aussteller" ? ausHtml() : wsHtml()}</div>` :
      `<div class="card"><p class="empty">Für ${esc(String(J.jahr))} ist kein detailliertes Programm mehr öffentlich verfügbar – die Eckdaten und Quellen oben fassen zusammen, was dokumentiert ist.</p></div>`}
      <footer class="irfoot"><p><b>Quelle:</b> ${esc(ARCHIV.quelle || "")}</p></footer>
    </div>`;
    $("#irZurueck").addEventListener("click", schliessen);
    $$("[data-jahr]").forEach(b => b.addEventListener("click", () => { z.jahr = parseInt(b.dataset.jahr, 10); z.q = ""; zeichneArchiv(); }));
    $$("[data-bereich]").forEach(b => b.addEventListener("click", () => { z.bereich = b.dataset.bereich; zeichneArchiv(); }));
    const su = $("#archivSuche");
    if (su) su.addEventListener("input", () => { z.q = su.value; const pos = su.selectionStart; zeichneArchiv(); const su2 = $("#archivSuche"); if (su2) { su2.focus(); su2.setSelectionRange(pos, pos); } });
  }

  /* ================= Viewer (Port des Event Insight Radar) ================= */

  function startViewer() {
    ROOT.classList.toggle("dunkel", istDunkel());
    ROOT.innerHTML = `<div class="wrap">
      <div class="chipline" style="margin-bottom:10px"><button class="btn small" id="irZurueck">← Anderes Event wählen</button><span class="chip">${esc(aktiveQuelle)}</span></div>
      <header class="top">
        <div>
          <div class="brand" id="brand"></div>
          <h1 id="h1"></h1>
          <div class="eyebrow" id="eyebrow"></div>
          <p class="lede" id="lede"></p>
        </div>
        <div class="tools">
          <div class="seg" role="group" aria-label="Sektoren">
            <button class="btn on" data-sector="dim" id="btnDim">Dimensionen</button>
            <button class="btn" data-sector="steep">STEEP</button>
          </div>
          <div class="seg" role="group" aria-label="Ringe">
            <button class="btn on" data-ring="beleg">Belegstärke</button>
            <button class="btn" data-ring="momentum" id="btnMomentum">Momentum</button>
          </div>
        </div>
      </header>
      <nav class="views" aria-label="Ansichten">
        <button class="btn on" data-view="radar">Radar</button>
        <button class="btn" data-view="sessions">Sessions &amp; Firmen</button>
        <button class="btn" data-view="liste">Alle Trends</button>
        <button class="btn" data-view="suche">Suche</button>
        <button class="btn" data-view="methode">Methodenblatt</button>
      </nav>
      <details class="bar" id="filterbar" open><summary class="btn small" style="list-style:none">Filter</summary>
        <span class="chipline" id="fRolle"><span style="font-size:12.5px">Absenderrolle</span></span>
        <label>Beitragsart <select id="fBeitrag"></select></label>
        <label>Evidenz <select id="fEvidenz"></select></label>
        <label id="lTag">Tag <select id="fTag"></select></label>
        <label id="lTrack">Track <select id="fTrack"></select></label>
        <label id="lEvent">Event <select id="fEvent"></select></label>
        <button class="btn small" id="btnReset">Filter zurücksetzen</button>
        <div class="chipline" id="filterinfo"></div>
      </details>
      <div id="viewRadar">
        <div class="main2">
          <div class="radarbox">
            <div class="crumbs" id="crumbs"></div>
            <svg id="radar" viewBox="0 0 900 640" role="img" aria-label="Event Insight Radar"></svg>
            <div class="ringlegend" id="ringlegend"></div>
            <div class="legend" id="legend"></div>
            <div class="actions" style="margin-top:10px"><button class="btn small" id="btnPng">Radar als PNG kopieren</button><button class="btn small" id="btnPngSave">Als PNG speichern</button></div>
          </div>
          <article class="card" id="card" aria-live="polite"></article>
        </div>
      </div>
      <div id="viewSessions" hidden><div class="card" id="sessliste"></div></div>
      <div id="viewListe" hidden><div class="card overview" id="liste"></div></div>
      <div id="viewSuche" hidden><div class="card srch"><div class="bar" style="margin:0"><div class="grow"><input type="search" id="q" placeholder="Signale durchsuchen (Aussage, Zitat, Session, Speaker, Firma) …" aria-label="Suche"></div></div><div id="sucheErg"></div></div></div>
      <div id="viewMethode" hidden><div class="card method" id="methode"></div></div>
      <footer class="irfoot" id="foot"></footer>
    </div>`;
    $("#irZurueck").addEventListener("click", schliessen);
    viewerLogik();
  }

  function viewerLogik() {
    const P = DATA.parameter || {};
    const num = (k, d) => { const v = parseFloat(P[k]); return isNaN(v) ? d : v };
    const W_SEK = num("w_sekundaer", .5), DECKEL = num("score_deckel_session", 2), BONUS = num("vielfalt_bonus", .1);
    const SCHW = DATA.schwellen_effektiv || {}; const MIN_S = SCHW.mikro_min_sessions || num("mikro_min_sessions", 3), MIN_R = num("mikro_min_rollen", 2), MK_M = num("makro_min_mikro", 2), MK_S = SCHW.makro_min_sessions || num("makro_min_sessions", 6);
    const ROLLEN_AKTIV = !(DATA.methodenblatt && DATA.methodenblatt.rollenkriterium_aktiv === false);
    const EVENTS = DATA.events || []; const MULTI = EVENTS.length > 1;
    const DIMS = DATA.dimensionen || []; const STEEP = (DATA.steep || []).map(s => ({ id: s, name: s }));
    const COLS = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c1", "--c2"];
    const sess = Object.fromEntries(DATA.sessions.map(s => [s.id, s]));
    const codes = {}; DATA.makro.forEach(c => codes[c.code_id] = c); (DATA.mikro || []).forEach(c => codes[c.code_id] = c);
    const kids = Object.fromEntries(DATA.makro.map(k => [k.code_id, (DATA.mikro || []).filter(m => m.parent_id === k.code_id)]));
    const sigByCode = {}; DATA.signale.forEach(g => (g.codes || []).forEach(c => { (sigByCode[c.id] = sigByCode[c.id] || []).push([g, c.gewicht]) }));
    const RINGS_BELEG = ["stark", "mittel", "schwach"], RINGS_MOM = ["neu", "steigend", "stabil", "fallend"];
    const RING_LABEL = { stark: "stark belegt", mittel: "mittel belegt", schwach: "schwach belegt", "schwaches Signal": "schwaches Signal (unter Schwelle)", "ohne Signale": "ohne Signale", neu: "neu", steigend: "steigend", stabil: "stabil", fallend: "fallend" };
    const NOROLE = new Set(["unbekannt", "Moderation/Veranstalter"]);

    // ---------- Zustand ----------
    const state = {
      sector: "dim", ring: "beleg", view: "radar", makro: null, mikro: null, signal: null,
      f: { rolle: new Set(), beitrag: "", evidenz: "", tag: "", track: "", event: "" }, q: ""
    };
    const filterAktiv = () => state.f.rolle.size || state.f.beitrag || state.f.evidenz || state.f.tag || state.f.track || state.f.event;
    function sessOk(s) {
      const f = state.f;
      if (f.event && s.event !== f.event) return false; if (f.tag && s.tag !== f.tag) return false; if (f.track && s.track !== f.track) return false;
      if (f.rolle.size && !s.rollen.some(r => f.rolle.has(r))) return false; return true
    }
    function sigOk(g) { const f = state.f; if (f.beitrag && g.beitragsart !== f.beitrag) return false; if (f.evidenz && g.evidenz !== f.evidenz) return false; return sessOk(sess[g.session]) }

    // ---------- Kennzahlen (Rechnung wie trend-score; ohne Filter: Exportwerte) ----------
    const calc = {};
    function kennzahlen(cid) {
      const c = codes[cid]; const aktiv = filterAktiv();
      if (!aktiv) { return { n_signale: c.n_signale, n_sessions: c.n_sessions, n_rollen: c.n_rollen, rollen: c.rollen || [], score: c.score, ist_trend: c.ist_trend, ring: c.ring, momentum: c.momentum, sigs: sigsOf(cid), n_mikrotrends: c.n_mikrotrends } }
      const sg = sigsOf(cid).filter(([g]) => sigOk(g));
      const per = {}, units = new Set(), rollen = new Set(), ids = new Set();
      sg.forEach(([g, gew]) => { const s = sess[g.session]; const u = s.zaehleinheit; per[u] = (per[u] || 0) + g.gewicht * (gew === "sekundaer" ? W_SEK : 1); units.add(u); s.rollen.forEach(r => { if (!NOROLE.has(r)) rollen.add(r) }); ids.add(g.id) });
      const roh = Object.values(per).reduce((a, v) => a + Math.min(DECKEL, v), 0);
      const score = Math.round(roh * (1 + BONUS * Math.max(0, rollen.size - 1)) * 100) / 100;
      const k = { n_signale: ids.size, n_sessions: units.size, n_rollen: rollen.size, rollen: [...rollen].sort(), score, sigs: sg, momentum: c.momentum };
      if (c.ebene === "mikro") { k.ist_trend = k.n_sessions >= MIN_S && (k.n_rollen >= MIN_R || !ROLLEN_AKTIV) }
      else { k.n_mikrotrends = kids[cid].filter(m => kz(m.code_id).ist_trend).length; k.ist_trend = k.n_mikrotrends >= MK_M || k.n_sessions >= MK_S }
      return k
    }
    function sigsOf(cid) { // Makro: Signale aller Mikros, je Signal einmal (primär bevorzugt)
      const c = codes[cid]; if (c.ebene === "mikro") return sigByCode[cid] || [];
      const m = {}; kids[cid].forEach(k => (sigByCode[k.code_id] || []).forEach(([g, gew]) => { if (!m[g.id] || gew === "primaer") m[g.id] = [g, gew] })); return Object.values(m)
    }
    function kz(cid) { if (!calc[cid]) calc[cid] = kennzahlen(cid); return calc[cid] }
    function ringe() { // Ringe nach Terzilen je Ebene (nur bei Filter neu)
      if (!filterAktiv()) return;
      [DATA.makro, DATA.mikro || []].forEach(list => {
        const tr = list.map(c => kz(c.code_id)).filter(k => k.ist_trend).map(k => k.score).sort((a, b) => a - b);
        const t1 = tr[Math.floor(tr.length / 3)] || 0, t2 = tr[Math.floor(2 * tr.length / 3)] || 0;
        list.forEach(c => { const k = kz(c.code_id); k.ring = !k.ist_trend ? (k.n_signale ? "schwaches Signal" : "ohne Signale") : k.score >= t2 ? "stark" : k.score >= t1 ? "mittel" : "schwach" })
      })
    }
    function recalc() { for (const k in calc) delete calc[k]; ringe() }

    // ---------- Hilfen ----------
    const sector = c => state.sector === "dim" ? c.dimension : c.steep;
    const sectors = () => state.sector === "dim" ? DIMS : STEEP;
    const secIdx = c => Math.max(0, sectors().findIndex(d => d.id === sector(c)));
    const colVar = c => COLS[secIdx(c) % COLS.length];
    const nr = cid => String(parseInt(cid.split("-")[1], 10));
    const ringOf = c => { const k = kz(c.code_id); return state.ring === "momentum" ? (k.momentum || "ohne Vergleich") : k.ring };
    const herk = (m, feld) => m && m[feld] ? m[feld] : null;
    function markMeta(txt, meta, feld) { // unsichere Metadaten dezent kennzeichnen
      const h = herk(meta, feld); if (!h || h.herkunft === "agenda" || h.herkunft === "nutzer") return esc(txt);
      const t = h.herkunft === "unbekannt" ? "unbekannt" : `aus ${h.herkunft === "inhalt" ? "Inhalt" : h.herkunft === "dateiname" ? "Dateiname" : "Begleitdatei"} erschlossen, Sicherheit ${h.sicherheit}${h.beleg ? " – „" + h.beleg.slice(0, 120) + "“" : ""}`;
      return `<span class="unsure" title="${esc(t)}">${esc(txt)}${h.herkunft === "unbekannt" ? "" : " ◌"}</span>`
    }
    function absText(s) {
      if (!s.absender || !s.absender.length) return `<span class="unsure" title="Speaker unbekannt">Speaker unbekannt</span>`;
      return s.absender.map(a => {
        const org = a.organisation ? ` (${esc(a.organisation)})` : ""; const rh = a.rolle_herkunft || ""; const unsicher = a.rolle === "unbekannt" || (rh && !rh.startsWith("agenda") && !rh.startsWith("nutzer"));
        const rolle = unsicher ? `<span class="unsure" title="Rolle ${a.rolle === 'unbekannt' ? 'unbekannt' : 'erschlossen (' + rh + ')'}">${esc(a.rolle)}${a.rolle === 'unbekannt' ? '' : ' ◌'}</span>` : esc(a.rolle);
        return `${esc(a.name || "unbekannt")}${org} · ${rolle}`
      }).join("; ")
    }
    function mixText(sigs) { // Absender-Mix auf Session-Ebene
      const per = {}, units = new Set();
      sigs.forEach(([g]) => { const s = sess[g.session]; if (units.has(s.zaehleinheit)) return; units.add(s.zaehleinheit); s.rollen.forEach(r => per[r] = (per[r] || 0) + 1) });
      const n = units.size || 1; const cnt = r => per[r] || 0;
      const anb = cnt("Anbieter etabliert") + cnt("Anbieter Startup") + cnt("Berater/Dienstleister"), anw = cnt("Anwender"), unab = cnt("Forschung") + cnt("Politik/Aufsicht/Regulierer");
      let satz;
      if (anw / n >= .5) satz = "überwiegend durch Anwender belegt"; else if (anb / n >= .6) satz = `überwiegend von Anbietern und Beratern getragen${anw >= 2 ? `, durch ${anw} Anwender-Session${anw > 1 ? "s" : ""} bestätigt` : anw === 1 ? ", eine Anwender-Session" : ", ohne Anwender-Bestätigung"}`;
      else satz = "gemischter Absender-Mix"; if (unab >= 2) satz += `; ${unab} Sessions aus Forschung/Aufsicht`;
      const order = Object.entries(per).sort((a, b) => b[1] - a[1]);
      const pal = ["--c3", "--c1", "--c4", "--c2", "--c5"];
      return { satz, order, n, html: `<div class="mix"><div class="bars">${order.map(([r, v], i) => `<i style="width:${100 * v / order.reduce((a, x) => a + x[1], 0)}%;background:var(${pal[i % pal.length]})" title="${esc(r)}: ${v}"></i>`).join("")}</div><div class="lab">${order.map(([r, v], i) => `<span><i style="background:var(${pal[i % pal.length]})"></i>${esc(r)} ${v}</span>`).join("")}</div><p>${esc(satz)}.</p></div>` }
    }
    function related(cid) { // verwandte Trends: Sessions-Überschneidung (Jaccard), Geschwister bevorzugt
      const c = codes[cid]; const mine = new Set(kz(cid).sigs.map(([g]) => g.session)); if (!mine.size) return [];
      const pool = (c.ebene === "mikro" ? (DATA.mikro || []) : DATA.makro).filter(x => x.code_id !== cid);
      return pool.map(x => { const o = new Set(kz(x.code_id).sigs.map(([g]) => g.session)); let i = 0; o.forEach(s => { if (mine.has(s)) i++ }); const j = i / (mine.size + o.size - i || 1); return [x, j + (x.parent_id && x.parent_id === c.parent_id ? .05 : 0), i] })
        .filter(([, j, i]) => i >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x, , i]) => [x, i])
    }

    // ---------- Radar ----------
    const NS = "http://www.w3.org/2000/svg";
    // Sofort-Tooltip für Radarpunkte (native SVG-<title> erscheinen erst nach ~1 s)
    function tipEl() { let t = document.getElementById("irTip"); if (!t) { t = document.createElement("div"); t.id = "irTip"; t.setAttribute("role", "tooltip"); document.body.appendChild(t) } return t }
    function tipShow(txt, e) { const t = tipEl(); t.textContent = txt; t.classList.add("on"); tipMove(e) }
    function tipMove(e) { const t = tipEl(); if (!t.classList.contains("on")) return; const x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8), y = e.clientY + 16 + t.offsetHeight > window.innerHeight ? e.clientY - t.offsetHeight - 10 : e.clientY + 16; t.style.left = x + "px"; t.style.top = y + "px" }
    function tipHide() { const t = document.getElementById("irTip"); if (t) t.classList.remove("on") }
    const cssVars = () => getComputedStyle(ROOT);
    function drawRadar() {
      const svg = $("#radar"); svg.classList.add("fade");
      setTimeout(() => { svg.innerHTML = ""; build(); svg.classList.remove("fade") }, cssVars().getPropertyValue("--dur").trim() === "0s" ? 0 : 120);
      function el(t, a, p) { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e }
      function build() {
        const cs = cssVars(); const col = v => cs.getPropertyValue(v).trim();
        const cx = 450, cy = 325, R = 262; const secs = sectors(); const nS = secs.length; const span = 360 / nS; const start = -90 - span / 2;
        const pol = (r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] };
        const zoom = !!state.makro; const items = (zoom ? kids[state.makro] : DATA.makro).slice();
        const ringNames = state.ring === "momentum" ? RINGS_MOM : RINGS_BELEG;
        const bands = {}; const inner = 52; const bw = (R - inner - 26) / ringNames.length; ringNames.forEach((r, i) => bands[r] = [inner + i * bw, inner + (i + 1) * bw]); const outer = [R - 26, R];
        // Sektoren
        secs.forEach((d, i) => {
          const a0 = start + i * span, a1 = a0 + span; const [x0, y0] = pol(R, a0), [x1, y1] = pol(R, a1);
          el("path", { d: `M${cx},${cy} L${x0},${y0} A${R},${R} 0 0,1 ${x1},${y1} Z`, fill: col(COLS[i % COLS.length]), opacity: .07 });
          el("line", { x1: cx, y1: cy, x2: x0, y2: y0, stroke: col("--line"), "stroke-width": 1 });
          const [lx, ly] = pol(R + 20, a0 + span / 2); const anchor = lx < cx - 20 ? "end" : lx > cx + 20 ? "start" : "middle"; const t = el("text", { x: lx, y: ly, "text-anchor": anchor, "font-size": 13, "font-weight": 700, fill: col(COLS[i % COLS.length]) });
          const full = (state.sector === "dim" ? d.id + " " : "") + d.name; const parts = full.length > 16 && anchor !== "middle" ? full.split(/ (?=[&–-]|und )|, /).reduce((a, w) => { const l = a[a.length - 1]; if (l && (l + " " + w).length <= 18) a[a.length - 1] = l + " " + w; else a.push(w); return a }, []) : [full];
          parts.forEach((pt, j) => { const ts = el("tspan", { x: lx, dy: j ? 14 : -(parts.length - 1) * 7 }, t); ts.textContent = pt })
        });
        // Ringe
        [...ringNames.map(r => bands[r][1]), R].forEach((r, i) => el("circle", { cx, cy, r, fill: "none", stroke: col("--line"), "stroke-width": i === ringNames.length ? 1.2 : 1, "stroke-dasharray": i === ringNames.length - 1 ? "4 4" : "" }));
        el("circle", { cx, cy, r: inner, fill: col("--surface"), stroke: col("--line") });
        const lab = el("text", { x: cx, y: cy + 4, "text-anchor": "middle", "font-size": 11, fill: col("--muted"), "font-family": "ui-monospace,Menlo,monospace" }); lab.textContent = zoom ? state.makro : "";
        ringNames.forEach((r, i) => { const t = el("text", { x: cx + 4, y: cy - bands[r][1] + 12, "font-size": 10, fill: col("--muted"), "font-family": "ui-monospace,Menlo,monospace" }); t.textContent = r });
        const to = el("text", { x: cx + 4, y: cy - R + 12, "font-size": 10, fill: col("--muted"), "font-family": "ui-monospace,Menlo,monospace" }); to.textContent = state.ring === "momentum" ? "ohne Vergleich" : "unter Schwelle";
        // Punkte
        const maxN = Math.max(1, ...items.map(c => kz(c.code_id).n_sessions));
        const groups = {}; items.forEach(c => { const k = sector(c) + "|" + ringOf(c); (groups[k] = groups[k] || []).push(c) });
        Object.values(groups).forEach(g => g.sort((a, b) => kz(b.code_id).score - kz(a.code_id).score));
        Object.entries(groups).forEach(([k, g]) => {
          const [sec, ring] = k.split("|"); const si = Math.max(0, secs.findIndex(d => d.id === sec)); const band = bands[ring] || outer;
          const a0 = start + si * span + 8, a1 = start + (si + 1) * span - 8; const n = g.length;
          const cols = n <= 2 ? n : Math.ceil(Math.sqrt(n * 1.6)), rows = Math.ceil(n / cols);
          g.forEach((c, i) => {
            const ci = i % cols, ri = Math.floor(i / cols); const inRow = Math.min(cols, n - ri * cols); const ang = a0 + (a1 - a0) * (ci + .5) / inRow; const fr = rows === 1 ? .5 : .2 + .6 * ri / (rows - 1); const r = band[0] + (band[1] - band[0]) * fr;
            const [x, y] = pol(r, ang); const kk = kz(c.code_id); const rad = zoom ? 7 + 9 * Math.sqrt(kk.n_sessions / maxN) : 9 + 13 * Math.sqrt(kk.n_sessions / maxN);
            const weak = !kk.ist_trend; const grp = el("g", { class: "dot" + (weak ? " hollowtxt" : ""), tabindex: 0, role: "button", "data-id": c.code_id, "aria-label": `${c.code_id} ${c.name}, ${kk.n_sessions} Sessions, ${ringOf(c)}` });
            grp.style.transformOrigin = `${x}px ${y}px`;
            el("circle", { class: "core" + (weak ? " hollow" : ""), cx: x, cy: y, r: rad, fill: col(colVar(c)), stroke: weak ? col(colVar(c)) : col("--surface") }, grp);
            const tx = el("text", { x, y: y + 4, "text-anchor": "middle", "font-size": zoom ? 10.5 : 11.5 }, grp); tx.textContent = nr(c.code_id);
            grp.dataset.tip = `${c.code_id} ${c.name}\n${kk.n_sessions} Sessions · ${kk.n_signale} Signale · ${kk.n_rollen} Rollen · Score ${fmt(kk.score)}\n${RING_LABEL[ringOf(c)] || ringOf(c)}`;
            grp.addEventListener("mouseenter", e => tipShow(grp.dataset.tip, e)); grp.addEventListener("mousemove", e => tipMove(e)); grp.addEventListener("mouseleave", tipHide);
            grp.addEventListener("focus", () => { const r = grp.getBoundingClientRect(); tipShow(grp.dataset.tip, { clientX: r.right, clientY: r.top }) }); grp.addEventListener("blur", tipHide);
            grp.addEventListener("click", () => go(c)); grp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(c) } });
          })
        });
        const selId = zoom ? state.mikro : state.makro; svg.classList.toggle("dimmed", !!selId && (zoom ? !!state.mikro : true));
        $$(".dot").forEach(d => d.classList.toggle("sel", d.dataset.id === selId));
        // Legende
        $("#legend").innerHTML = secs.map((d, i) => {
          const its = items.filter(c => sector(c) === d.id).sort((a, b) => kz(b.code_id).score - kz(a.code_id).score);
          return `<section><h4><i style="background:var(${COLS[i % COLS.length]})"></i>${esc((state.sector === "dim" ? d.id + " " : "") + d.name)}</h4><ol>${its.map(c => `<li><em>${nr(c.code_id)}</em><button data-go="${c.code_id}">${esc(c.name)}</button></li>`).join("") || "<li><em>–</em><span>keine</span></li>"}</ol></section>`
        }).join("");
        $$("#legend button").forEach(b => b.addEventListener("click", () => go(codes[b.dataset.go])));
        $("#ringlegend").innerHTML = (state.ring === "momentum" ? `<span><b>Ringe</b> Momentum: neu · steigend · stabil · fallend (Session-Anteil im letzten Event vs. Vorgänger)</span>` : `<span><b>Ringe</b> innen = stark belegt (oberes Score-Terzil), Mitte = mittel, außen = schwach; gestrichelt = unter Schwelle (schwaches Signal)</span>`) + `<span><b>Punktgröße</b> Anzahl Sessions</span>`;
        $("#crumbs").innerHTML = zoom ? `<button class="btn small" id="crumbUp">← Alle Makrotrends</button><span>›</span><b>${esc(codes[state.makro].code_id)} ${esc(codes[state.makro].name)}</b>${state.mikro ? `<span>›</span><span>${esc(state.mikro)}</span>` : ""}` : `<b>Makrotrends</b><span>· Klick auf einen Punkt zoomt in die Mikrotrends</span>`;
        const up = $("#crumbUp"); if (up) up.addEventListener("click", () => { nav({ makro: null, mikro: null, signal: null }) });
      }
    }
    function go(c) { if (c.ebene === "makro") nav({ makro: c.code_id, mikro: null, signal: null }); else nav({ makro: c.parent_id, mikro: c.code_id, signal: null }); }

    // ---------- Karten ----------
    const LINK_ICON = { original: ["▶", "Original an der Fundstelle öffnen"], video: ["▶", "Video öffnen (Zeitpunkt nicht sicher zugeordnet)"], agenda: ["📄", "Agenda-Eintrag der Session öffnen"], event: ["🌐", "Event-Seite öffnen"] };
    function linkHtml(g) { const st = g.link_stufe || (g.link ? "original" : "keine"); if (!g.link || !/^https?:/i.test(g.link) || st === "keine") return g.quelle_text ? ` · <span class="unsure" title="${esc(g.quelle_text)}">Quelle nicht öffentlich</span>` : ""; const [ic, t] = LINK_ICON[st] || LINK_ICON.original; return ` · <a href="${esc(g.link)}" target="_blank" rel="noopener" title="${esc(t)}">${ic} ${st === "original" ? "Quelle" : st === "video" ? "Video" : st === "agenda" ? "Agenda" : "Event"} ↗</a>` }
    function sigHtml(g, gew) {
      const s = sess[g.session]; const warn = []; if (g.unsicher) warn.push(`<span class="flag warn" title="Spracherkennung/Zuordnung unsicher">⚠ unsicher</span>`); if (g.paraphrase) warn.push(`<span class="flag" title="Zitat nicht wörtlich im Quelltext auffindbar">Paraphrase</span>`); if (gew === "sekundaer") warn.push(`<span class="flag" title="Sekundärcodierung">sekundär</span>`);
      const erf = s.erfassung && s.erfassung !== "vollständig" ? `<span class="flag" title="Erfassungsgrad der Session">${esc(s.erfassung)} erfasst</span>` : "";
      return `<div class="sig${state.signal === g.id ? " hl" : ""}" id="sig-${esc(g.id)}"><div class="a">${esc(g.aussage)}</div><blockquote>„${esc(g.zitat)}“</blockquote>
      <div class="meta"><span class="sid">${esc(g.id)}</span><span title="${esc(s.titel)}">${markMeta(s.titel.length > 70 ? s.titel.slice(0, 68) + "…" : s.titel, s.meta, "titel")}</span><span>${absText(s)}${g.sprecher ? ` · spricht: ${esc(g.sprecher)}` : ""}</span>
      <span>${esc(g.typ)} · ${esc(g.beitragsart)} · ${esc(g.evidenz)} · Eigeninteresse ${esc(g.eigeninteresse)}</span><span>${esc(g.fundstelle || "")}${linkHtml(g)}</span>
      ${MULTI ? `<span>${esc(s.event)}</span>` : ""}${warn.join("")}${erf}</div></div>`
    }
    function cardMakro(k) {
      const K = kz(k.code_id); const ms = kids[k.code_id].map(m => [m, kz(m.code_id)]).sort((a, b) => b[1].score - a[1].score); const mx = Math.max(1, ...ms.map(([, x]) => x.score));
      const mix = mixText(K.sigs); const rel = related(k.code_id);
      const gegen = K.sigs.filter(([g]) => g.typ === "gegenposition").sort((a, b) => b[0].gewicht - a[0].gewicht).slice(0, 3);
      return `<header><div class="kind"><span>Makrotrend ${esc(k.code_id)}</span><span class="chip dim" style="color:var(${colVar(k)})">${esc(secLabel(k))}</span><span class="chip">STEEP ${esc(k.steep)}</span><span class="ringtag ${ringCls(K)}">${esc(RING_LABEL[ringOf(k)] || ringOf(k))}</span></div><h2>${esc(k.name)}</h2><p class="kern">${esc(k.definition || "")}</p></header>
      ${metrics(K)}
      <div><h3>Absender-Mix (Sessions)</h3>${mix.html}</div>
      ${MULTI ? cmpHtml(k) : ""}
      <div><h3>Mikrotrends (${ms.filter(([, x]) => x.ist_trend).length} von ${ms.length} über Schwelle)</h3><div class="mikros" style="--dimcol:var(${colVar(k)})">${ms.map(([m, x]) => `<button data-go="${m.code_id}"><span class="id">${esc(m.code_id)}</span><span>${esc(m.name)}</span><span class="n">${x.n_sessions} S · ${x.n_rollen} R · <span class="ringtag ${ringCls(x)}">${esc(x.ring)}</span></span><span class="bar2"><i style="width:${100 * x.score / mx}%"></i></span></button>`).join("")}</div></div>
      ${gegen.length ? `<div><h3>Gegenstimmen (Auswahl)</h3><div class="sigs">${gegen.map(([g, w]) => sigHtml(g, w)).join("")}</div></div>` : ""}
      ${rel.length ? `<div><h3>Verwandte Makrotrends</h3><div class="related">${rel.map(([x, i]) => `<button data-go="${x.code_id}" title="${i} gemeinsame Sessions">${esc(x.code_id)} ${esc(x.name)}</button>`).join("")}</div></div>` : ""}
      <div class="actions"><button class="btn small" data-copy="${k.code_id}">Trendkarte kopieren</button></div>`
    }
    function cardMikro(m) {
      const K = kz(m.code_id); const k = codes[m.parent_id]; const mix = mixText(K.sigs); const rel = related(m.code_id);
      const all = K.sigs.slice().sort((a, b) => (b[1] === "primaer") - (a[1] === "primaer") || b[0].gewicht - a[0].gewicht);
      const belege = all.filter(([g]) => g.typ !== "gegenposition"), gegen = all.filter(([g]) => g.typ === "gegenposition");
      const lim = state.alleSig === m.code_id ? belege.length : 6;
      return `<header><div class="kind"><span>Mikrotrend ${esc(m.code_id)} · in <button class="more" data-go="${k.code_id}">${esc(k.code_id)} ${esc(k.name)}</button></span></div>
      <div class="kind"><span class="chip dim" style="color:var(${colVar(m)})">${esc(secLabel(m))}</span><span class="chip">STEEP ${esc(m.steep)}</span><span class="ringtag ${ringCls(K)}">${esc(RING_LABEL[ringOf(m)] || ringOf(m))}</span>${m.seit_event && MULTI ? `<span class="chip">seit ${esc(m.seit_event)}</span>` : ""}</div>
      <h2>${esc(m.name)}</h2><p class="kern">${esc(m.definition || "")}</p>${m.abgrenzung ? `<p class="abgr">Abgrenzung: ${esc(m.abgrenzung)}</p>` : ""}</header>
      ${metrics(K)}
      <div><h3>Absender-Mix (Sessions)</h3>${mix.html}</div>
      ${MULTI ? cmpHtml(m) : ""}
      <div><h3>Belegzitate (${belege.length})</h3><div class="sigs">${belege.slice(0, lim).map(([g, w]) => sigHtml(g, w)).join("") || `<p class="empty">Keine Signale im aktuellen Filter.</p>`}</div>${belege.length > lim ? `<button class="more" data-all="${m.code_id}">alle ${belege.length} Belege anzeigen</button>` : ""}</div>
      ${gegen.length ? `<div><h3>Gegenstimmen (${gegen.length})</h3><div class="sigs">${gegen.map(([g, w]) => sigHtml(g, w)).join("")}</div></div>` : ""}
      ${rel.length ? `<div><h3>Verwandte Mikrotrends</h3><div class="related">${rel.map(([x, i]) => `<button data-go="${x.code_id}" title="${i} gemeinsame Sessions">${esc(x.code_id)} ${esc(x.name)}</button>`).join("")}</div></div>` : ""}
      <div class="actions"><button class="btn small" data-copy="${m.code_id}">Trendkarte kopieren</button></div>`
    }
    function cardOverview() {
      const ks = DATA.makro.map(k => [k, kz(k.code_id)]).sort((a, b) => b[1].score - a[1].score); const nTr = ks.filter(([, x]) => x.ist_trend).length;
      const nM = (DATA.mikro || []).filter(m => kz(m.code_id).ist_trend).length; const nSig = DATA.signale.filter(sigOk).length; const nSes = new Set(DATA.signale.filter(sigOk).map(g => g.session)).size;
      return `<header><div class="kind"><span>Übersicht</span></div><h2>${esc(nTr)} Makrotrends, ${nM} Mikrotrends</h2><p class="kern">${nSig} Signale aus ${nSes} Sessions${filterAktiv() ? " im aktuellen Filter" : ""}. Auswahl ausschließlich über Schwellen: Mikrotrend ab ${MIN_S} Sessions${ROLLEN_AKTIV ? ` und ${MIN_R} Absenderrollen` : ""}, Makrotrend ab ${MK_M} Mikrotrends oder ${MK_S} Sessions.</p></header>
      <div class="mikros">${ks.map(([k, x]) => `<button data-go="${k.code_id}" style="--dimcol:var(${colVar(k)})"><span class="id">${esc(k.code_id)}</span><span>${esc(k.name)}</span><span class="n">${x.n_sessions} S · ${x.n_rollen} R · <span class="ringtag ${ringCls(x)}">${esc(state.ring === "momentum" ? (x.momentum || "–") : x.ring)}</span></span><span class="bar2"><i style="width:${100 * x.score / Math.max(1, ks[0][1].score)}%"></i></span></button>`).join("")}</div>
      <p class="abgr">Klick auf einen Makrotrend zeigt seine Mikrotrends; Klick auf einen Mikrotrend die belegten Signale mit Zitat und Fundstelle.</p>`
    }
    const secLabel = c => { const s = sectors().find(d => d.id === sector(c)); return s ? (state.sector === "dim" ? s.id + " " : "") + s.name : sector(c) };
    const ringCls = K => K.ist_trend ? (K.ring || "schwach") : "weak";
    function metrics(K) { return `<div class="metrics"><div><b>${K.n_signale}</b><small>Signale</small></div><div><b>${K.n_sessions}</b><small>Sessions (Zähleinheiten)</small></div><div><b>${K.n_rollen}</b><small>Absenderrollen</small></div><div><b>${fmt(K.score)}</b><small>Score</small></div></div>` }
    function cmpHtml(c) {
      const a = c.anteile_je_event || {}; const evs = Object.keys(a); if (!evs.length) return ""; const mx = Math.max(.01, ...evs.map(e => a[e]));
      return `<div><h3>Vergleich der Events (Anteil Sessions mit diesem Trend)</h3><div class="cmp" style="--dimcol:var(${colVar(c)})">${evs.map(e => `<div class="row"><span>${esc(e)}</span><i style="width:${100 * a[e] / mx}%"></i><em>${Math.round(100 * a[e])} %</em></div>`).join("")}</div>${c.momentum ? `<p class="abgr">Momentum: ${esc(c.momentum)}</p>` : ""}</div>`
    }
    function drawCard() {
      const card = $("#card"); card.classList.remove("card"); void card.offsetWidth; card.classList.add("card");
      card.innerHTML = state.mikro ? cardMikro(codes[state.mikro]) : state.makro ? cardMakro(codes[state.makro]) : cardOverview();
      $$("#card [data-go]").forEach(b => b.addEventListener("click", () => { state.scrollCard = true; go(codes[b.dataset.go]) }));
      $$("#card [data-all]").forEach(b => b.addEventListener("click", () => { state.alleSig = b.dataset.all; drawCard() }));
      $$("#card [data-copy]").forEach(b => b.addEventListener("click", () => copyCard(b.dataset.copy)));
      if (state.signal) { const e = document.getElementById("sig-" + state.signal); if (e) e.scrollIntoView({ block: "center", behavior: cssVars().getPropertyValue("--dur").trim() === "0s" ? "auto" : "smooth" }) }
    }

    // ---------- Sessions & Firmen ----------
    function drawSessions() {
      const S = DATA.sessions.filter(sessOk).slice().sort((a, b) => (a.tag || "").localeCompare(b.tag || "") || (a.start || "").localeCompare(b.start || ""));
      const nSig = {}; DATA.signale.forEach(g => { if (sigOk(g)) nSig[g.session] = (nSig[g.session] || 0) + 1 });
      const firmen = {};
      S.forEach(s => (s.absender || []).forEach(a => {
        if (!a.organisation) return; const f = firmen[a.organisation] = firmen[a.organisation] || { sessions: new Set(), namen: new Set(), rollen: new Set() };
        f.sessions.add(s.id); if (a.name) f.namen.add(a.name); if (a.rolle && a.rolle !== "unbekannt") f.rollen.add(a.rolle);
      }));
      const fl = Object.entries(firmen).sort((a, b) => b[1].sessions.size - a[1].sessions.size || a[0].localeCompare(b[0]));
      const typLabel = { vortrag: "Vortrag", panel: "Panel", workshop: "Workshop", moderation: "Moderation" };
      $("#sessliste").innerHTML = `<header><div class="kind"><span>Sessions &amp; Firmen</span></div><h2>${S.length} Sessions, ${fl.length} Firmen</h2><p class="abgr">Alle erfassten Vorträge, Panels und Workshops mit Speakern und Organisationen${filterAktiv() ? " im aktuellen Filter" : ""}. „→ Signale“ zeigt die belegten Aussagen der Session.</p></header>
      <div><h3>Firmen &amp; Organisationen</h3><div class="firmen">${fl.map(([name, f]) => `<div class="firma"><b>${esc(name)}</b><small>${f.sessions.size} Session${f.sessions.size > 1 ? "s" : ""}${f.rollen.size ? " · " + esc([...f.rollen].join(", ")) : ""}</small><small>${esc([...f.namen].slice(0, 4).join(", "))}${f.namen.size > 4 ? " …" : ""}</small><div><button class="more" data-firma="${esc(name)}">→ Signale</button></div></div>`).join("") || `<p class="empty">Keine Organisationen im aktuellen Filter.</p>`}</div></div>
      <div><h3>Sessions (${S.length})</h3><div class="sess">${S.map(s => `<div class="sessrow"><div class="t">${markMeta(s.titel, s.meta, "titel")}</div>
        <div class="meta"><span class="chip">${esc(typLabel[s.typ] || s.typ || "Session")}</span>${s.tag ? `<span>${esc(s.tag)}${s.start ? " · " + esc(s.start) : ""}</span>` : ""}${s.track ? `<span>Track: ${esc(s.track)}</span>` : ""}${MULTI ? `<span>${esc(s.event)}</span>` : ""}${s.erfassung && s.erfassung !== "vollständig" ? `<span class="flag">${esc(s.erfassung)} erfasst</span>` : ""}</div>
        <div class="meta"><span>${absText(s)}</span></div>
        <div class="meta"><span>${nSig[s.id] || 0} Signale</span>${nSig[s.id] ? `<button class="more" data-sess="${esc(s.id)}">→ Signale</button>` : ""}</div></div>`).join("") || `<p class="empty">Keine Sessions im aktuellen Filter.</p>`}</div></div>`;
      $$("#sessliste [data-sess]").forEach(b => b.addEventListener("click", () => { const s = sess[b.dataset.sess]; state.q = s.titel; setView("suche") }));
      $$("#sessliste [data-firma]").forEach(b => b.addEventListener("click", () => { state.q = b.dataset.firma; setView("suche") }));
    }

    // ---------- Liste, Suche, Methodenblatt ----------
    function drawListe() {
      const rows = []; DATA.makro.map(k => [k, kz(k.code_id)]).sort((a, b) => b[1].score - a[1].score).forEach(([k, x]) => {
        rows.push(`<tr class="makro${x.ist_trend ? "" : " off"}"><td><span class="dimdot" style="background:var(${colVar(k)})"></span><button class="lnk" data-go="${k.code_id}">${esc(k.code_id)} ${esc(k.name)}</button></td><td>${esc(secLabel(k))}</td><td>${esc(k.steep)}</td><td class="num">${x.n_signale}</td><td class="num">${x.n_sessions}</td><td class="num">${x.n_rollen}</td><td class="num">${fmt(x.score)}</td><td><span class="ringtag ${ringCls(x)}">${esc(state.ring === "momentum" ? (x.momentum || "–") : x.ring)}</span></td></tr>`);
        kids[k.code_id].map(m => [m, kz(m.code_id)]).sort((a, b) => b[1].score - a[1].score).forEach(([m, y]) => rows.push(`<tr class="mikro${y.ist_trend ? "" : " off"}"><td><button class="lnk" data-go="${m.code_id}">${esc(m.code_id)} ${esc(m.name)}</button></td><td>${esc(secLabel(m))}</td><td>${esc(m.steep)}</td><td class="num">${y.n_signale}</td><td class="num">${y.n_sessions}</td><td class="num">${y.n_rollen}</td><td class="num">${fmt(y.score)}</td><td><span class="ringtag ${ringCls(y)}">${esc(state.ring === "momentum" ? (y.momentum || "–") : y.ring)}</span></td></tr>`))
      });
      $("#liste").innerHTML = `<header><div class="kind"><span>Alle Codes</span></div><h2>Makro- und Mikrotrends</h2><p class="abgr">Sortiert nach Score. Grau = unter Schwelle (schwaches Signal).</p></header><div style="overflow:auto"><table><thead><tr><th>Code</th><th>Sektor</th><th>STEEP</th><th>Signale</th><th>Sessions</th><th>Rollen</th><th>Score</th><th>Ring</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
      $$("#liste [data-go]").forEach(b => b.addEventListener("click", () => { const c = codes[b.dataset.go]; state.lastGo = c.code_id; state.view = "radar"; go(c) }));
      const last = state.lastGo && $(`#liste [data-go="${CSS.escape(state.lastGo)}"]`);
      if (last) { const tr = last.closest("tr"); tr.classList.add("lastopen"); requestAnimationFrame(() => tr.scrollIntoView({ block: "center" })) }
    }
    function drawSuche() {
      const q = state.q.trim().toLowerCase(); const out = $("#sucheErg"); if (q.length < 2) { out.innerHTML = `<p class="empty">Mindestens zwei Zeichen eingeben. Durchsucht werden Aussage, Zitat, Session-Titel, Speaker und Firma (${DATA.signale.length} Signale).</p>`; return }
      const hits = DATA.signale.filter(g => { const s = sess[g.session]; return (g.aussage + " " + g.zitat + " " + s.titel + " " + (s.absender || []).map(a => a.name + " " + (a.organisation || "")).join(" ")).toLowerCase().includes(q) }).filter(sigOk);
      const byCode = {}; hits.forEach(g => { const c = (g.codes || []).find(x => x.gewicht === "primaer") || (g.codes || [])[0]; const id = c ? c.id : "offen"; (byCode[id] = byCode[id] || []).push(g) });
      out.innerHTML = `<p class="abgr">${hits.length} Treffer${filterAktiv() ? " im aktuellen Filter" : ""}</p>` + Object.entries(byCode).sort((a, b) => b[1].length - a[1].length).map(([id, gs]) => { const c = codes[id]; return `<div class="grp"><h4>${c ? `<button class="more" data-go="${id}">${esc(id)} ${esc(c.name)}</button>` : "ohne Code (offen)"} · ${gs.length}</h4><div class="sigs">${gs.slice(0, 20).map(g => sigHtml(g, "primaer")).join("")}${gs.length > 20 ? `<p class="abgr">… ${gs.length - 20} weitere</p>` : ""}</div></div>` }).join("");
      $$("#sucheErg [data-go]").forEach(b => b.addEventListener("click", () => { setView("radar"); go(codes[b.dataset.go]) }))
    }
    function md(src) { // minimaler Markdown-Renderer für das Methodenblatt
      const lines = src.split("\n"); let h = "", inUl = false, inT = false, rows = []; const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
      const flushT = () => { if (!inT) return; h += `<table>${rows.map((r, i) => `<tr>${r.map(c => `<${i ? "td" : "th"}>${inl(c)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</table>`; inT = false; rows = [] };
      lines.forEach(l => {
        if (/^\|/.test(l)) { if (/^\|\s*-/.test(l)) return; rows.push(l.replace(/^\||\|$/g, "").split("|").map(s => s.trim())); inT = true; return } flushT();
        if (/^- /.test(l)) { if (!inUl) { h += "<ul>"; inUl = true } h += `<li>${inl(l.slice(2))}</li>`; return } if (inUl) { h += "</ul>"; inUl = false }
        const m = /^(#+)\s*(.*)/.exec(l); if (m) { h += `<h${Math.min(3, m[1].length + 1)}>${inl(m[2])}</h${Math.min(3, m[1].length + 1)}>`; return } if (l.trim()) h += `<p>${inl(l)}</p>`
      });
      if (inUl) h += "</ul>"; flushT(); return h
    }
    function drawMethode() {
      const mb = DATA.methodenblatt || {}; const par = Object.entries(P).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`).join("");
      $("#methode").innerHTML = md(mb.markdown || "# Methodenblatt\n\nnicht vorhanden") + `<h3>Effektive Schwellen</h3><ul><li>Mikrotrend: ≥ ${MIN_S} Sessions${ROLLEN_AKTIV ? ` und ≥ ${MIN_R} bekannte Absenderrollen` : " (Rollenkriterium entfällt)"} · Makrotrend: ≥ ${MK_M} Mikrotrends oder ≥ ${MK_S} Sessions · Zähleinheiten gesamt: ${SCHW.zaehleinheiten || "–"}</li></ul><h3>Parameter</h3><table><tr><th>Name</th><th>Wert</th></tr>${par}</table><h3>Export</h3><ul><li>Export-ID <code>${esc(DATA.export_id)}</code> · Stand ${esc(DATA.stand)} · Codebuch v${esc(DATA.codebuch_version)} · Format ${esc(DATA.format)}</li></ul>`
    }

    // ---------- Kopieren ----------
    function cardText(cid) {
      const c = codes[cid]; const K = kz(cid); const mix = mixText(K.sigs); const lines = []; const parent = c.parent_id ? codes[c.parent_id] : null;
      const title = `${c.ebene === "makro" ? "Makrotrend" : "Mikrotrend"} ${c.code_id}: ${c.name}`;
      lines.push(`# ${title}`, "", c.definition || "", c.abgrenzung ? `Abgrenzung: ${c.abgrenzung}` : "", parent ? `Makrotrend: ${parent.code_id} ${parent.name}` : "",
        `Sektor: ${secLabel(c)} · STEEP: ${c.steep} · ${state.ring === "momentum" ? "Momentum" : "Belegstärke"}: ${RING_LABEL[ringOf(c)] || ringOf(c)}`,
        `Signale ${K.n_signale} · Sessions ${K.n_sessions} · Absenderrollen ${K.n_rollen} · Score ${fmt(K.score)}`,
        `Absender-Mix: ${mix.order.map(([r, v]) => `${r} ${v}`).join(", ")} – ${mix.satz}.`, "");
      if (c.ebene === "makro") { lines.push("## Mikrotrends"); kids[cid].map(m => [m, kz(m.code_id)]).sort((a, b) => b[1].score - a[1].score).forEach(([m, x]) => lines.push(`- ${m.code_id} ${m.name} (${x.n_sessions} Sessions, ${x.n_rollen} Rollen, ${x.ist_trend ? x.ring : "unter Schwelle"})`)); lines.push("") }
      const sg = K.sigs.slice().sort((a, b) => b[0].gewicht - a[0].gewicht); const bel = sg.filter(([g]) => g.typ !== "gegenposition").slice(0, c.ebene === "makro" ? 5 : 10), geg = sg.filter(([g]) => g.typ === "gegenposition").slice(0, 5);
      const sigLine = ([g]) => { const s = sess[g.session]; return `- ${g.aussage}\n  > „${g.zitat}“ — ${g.id}, ${s.titel}${s.absender && s.absender.length ? ` (${s.absender.map(a => a.name + (a.organisation ? ", " + a.organisation : "")).join("; ")})` : ""}, ${g.fundstelle || ""}${g.link && /^https?:/i.test(g.link) ? " " + g.link : (g.quelle_text ? " (" + g.quelle_text + ")" : "")}${g.unsicher ? " ⚠ unsicher" : ""}` };
      if (bel.length) { lines.push("## Belegzitate"); bel.forEach(x => lines.push(sigLine(x))); lines.push("") } if (geg.length) { lines.push("## Gegenstimmen"); geg.forEach(x => lines.push(sigLine(x))); lines.push("") }
      const rel = related(cid); if (rel.length) lines.push(`Verwandte Trends: ${rel.map(([x]) => x.code_id + " " + x.name).join("; ")}`, "");
      lines.push(`Quelle: ${DATA.titel} · Export ${DATA.export_id} · Codebuch v${DATA.codebuch_version}${filterAktiv() ? " · gefiltert" : ""}`);
      const mdTxt = lines.filter(l => l !== undefined).join("\n");
      const html = `<div>${md(mdTxt).replace(/<p>&gt; /g, "<blockquote>").replace(/“<\/p>/g, "“</blockquote>")}</div>`; return { text: mdTxt, html }
    }
    async function copyCard(cid) {
      const { text, html } = cardText(cid);
      try {
        if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]); irToast("Trendkarte kopiert (HTML + Markdown)"); return }
        if (navigator.clipboard) { await navigator.clipboard.writeText(text); irToast("Trendkarte als Markdown kopiert"); return } throw new Error("no clipboard")
      }
      catch (e) { try { const r = document.createRange(); r.selectNodeContents($("#card")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); irToast("Kopieren nicht erlaubt – Karte ist markiert, bitte Strg/Cmd+C") } catch (e2) { irToast("Kopieren nicht möglich") } }
    }
    function pngKomposit(radar, cs) { // Radar + Kopf + nummerierte Legende (nach Sektoren) + Lesehilfe
      const v = n => cs.getPropertyValue(n).trim(); const FF = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      const secs = [...$$("#legend section")].map(sec => ({
        name: sec.querySelector("h4").textContent.trim(), col: getComputedStyle(sec.querySelector("h4 i")).backgroundColor,
        items: [...sec.querySelectorAll("li")].map(li => ({ nr: (li.querySelector("em") || {}).textContent || "", name: (li.querySelector("button,span") || {}).textContent || "", id: (li.querySelector("button") || { dataset: {} }).dataset.go }))
      }));
      const LH = 17, colW = 330, top = 64, rH = 640; let lines = 0; secs.forEach(s => lines += 1.6 + s.items.length);
      const maxLines = Math.floor((rH - 10) / LH); const nCols = lines > maxLines ? 2 : 1; const W = 900 + nCols * colW + 20;
      const foot = ["Lesehilfe: Nummer = Trend (Legende) · Punktgröße = Sessions · Farbe = Sektor · " + (state.ring === "momentum" ? "Ringe = Momentum (neu · steigend · stabil · fallend)" : "Ringe innen → außen = stark → schwach belegt; hohl/gestrichelt = unter Schwelle"),
        `Quelle: ${DATA.titel} · Codebuch ${DATA.codebuch_version || "–"} · Stand ${(DATA.stand || "").slice(0, 10)} · Methode siehe Methodenblatt im Viewer`];
      const H = top + Math.max(rH, Math.ceil(lines / nCols) * LH + 20) + 16 + foot.length * 16;
      const o = document.createElementNS(NS, "svg"); o.setAttribute("xmlns", NS); o.setAttribute("width", W); o.setAttribute("height", H); o.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const el = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; o.appendChild(e); return e };
      el("rect", { x: 0, y: 0, width: W, height: H, fill: v("--bg") });
      el("text", { x: 16, y: 28, "font-size": 20, "font-weight": 700, fill: v("--fg"), "font-family": FF }, `${KONFIG.produktname} – ${DATA.titel || ""}`);
      el("text", { x: 16, y: 50, "font-size": 12, fill: v("--muted"), "font-family": FF }, `${state.makro ? "Mikrotrends in " + codes[state.makro].code_id + " " + codes[state.makro].name : "Makrotrends"} · ${state.sector === "dim" ? "Sektoren: Dimensionen" : "Sektoren: STEEP"} · ${state.ring === "momentum" ? "Ringe: Momentum" : "Ringe: Belegstärke"}${filterAktiv() ? " · gefiltert" : ""}`);
      radar.setAttribute("x", 0); radar.setAttribute("y", top); radar.setAttribute("width", 900); radar.setAttribute("height", rH); o.appendChild(radar);
      let col = 0, y = top + 18; const x0 = () => 900 + 10 + col * colW;
      const cut = (t, n) => t.length > n ? t.slice(0, n - 1) + "…" : t;
      secs.forEach(s => {
        if (y + LH * (1.6 + Math.min(2, s.items.length)) > top + rH && col < nCols - 1) { col++; y = top + 18 }
        el("rect", { x: x0(), y: y - 10, width: 10, height: 10, rx: 2, fill: s.col }); el("text", { x: x0() + 16, y, "font-size": 12.5, "font-weight": 700, fill: v("--fg"), "font-family": FF }, cut(s.name, 40)); y += LH * 1.1;
        s.items.forEach(it => {
          if (y > top + rH - 4 && col < nCols - 1) { col++; y = top + 18 }
          const K = it.id && codes[it.id] ? kz(it.id) : null; const mom = K && K.momentum ? ({ neu: " ✦", steigend: " ↑", stabil: " →", fallend: " ↓" }[K.momentum] || "") : "";
          el("text", { x: x0() + 4, y, "font-size": 11.5, "font-weight": 600, fill: v("--muted"), "font-family": "ui-monospace, Menlo, Consolas, monospace" }, it.nr);
          el("text", { x: x0() + 30, y, "font-size": 11.5, fill: K && !K.ist_trend ? v("--muted") : v("--fg"), "font-family": FF }, cut(it.name, 52) + mom); y += LH
        });
        y += LH * .5
      });
      foot.forEach((t, i) => el("text", { x: 16, y: H - 10 - (foot.length - 1 - i) * 16, "font-size": 11, fill: v("--muted"), "font-family": FF }, t));
      return { svg: o, W, H }
    }
    function radarPng(cb) {
      const svg = $("#radar"); const cs = cssVars();
      const clone = svg.cloneNode(true); clone.setAttribute("xmlns", NS); clone.setAttribute("width", "900"); clone.setAttribute("height", "640"); clone.removeAttribute("class"); clone.removeAttribute("id"); clone.querySelectorAll("title").forEach(t => t.remove());
      clone.querySelectorAll("text").forEach(t => { if (!t.getAttribute("font-family")) t.setAttribute("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"); if (!t.getAttribute("fill")) t.setAttribute("fill", t.parentNode.classList.contains("hollowtxt") ? cs.getPropertyValue("--fg").trim() : "#fff"); if (t.parentNode.classList.contains("dot")) { t.setAttribute("font-weight", "600"); t.setAttribute("font-family", "ui-monospace, Menlo, Consolas, monospace") } });
      clone.querySelectorAll("circle.core").forEach(c => { if (c.classList.contains("hollow")) c.setAttribute("fill", cs.getPropertyValue("--surface").trim()); if (!c.getAttribute("stroke-width")) c.setAttribute("stroke-width", "2") });
      clone.querySelectorAll(".dot").forEach(d => { if (svg.classList.contains("dimmed") && !d.classList.contains("sel")) d.setAttribute("opacity", ".3") });
      const bg = document.createElementNS(NS, "rect"); bg.setAttribute("x", 0); bg.setAttribute("y", 0); bg.setAttribute("width", 900); bg.setAttribute("height", 640); bg.setAttribute("fill", cs.getPropertyValue("--bg").trim()); clone.insertBefore(bg, clone.firstChild);
      const { svg: full, W, H } = pngKomposit(clone, cs);
      const src = new XMLSerializer().serializeToString(full); const img = new Image(); const scale = 2; img.onload = () => { const c = document.createElement("canvas"); c.width = W * scale; c.height = H * scale; const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, W * scale, H * scale); c.toBlob(b => cb(b, null), "image/png") }; img.onerror = e => cb(null, e);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src)
    }
    function pngSlug(t) { return String(t).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) }
    function savePng(blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${pngSlug(DATA.titel || DATA.export_id || "export")}-event-insight-radar${state.makro ? "-" + pngSlug(state.makro) : ""}.png`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500) }
    $("#btnPng").addEventListener("click", () => radarPng(async (b, err) => {
      if (!b) { irToast("PNG konnte nicht erzeugt werden"); return }
      try { if (!navigator.clipboard || !window.ClipboardItem) throw new Error("x"); await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]); irToast("Radar als PNG kopiert") } catch (e) { savePng(b); irToast("Zwischenablage nicht verfügbar – PNG wird gespeichert") }
    }));
    $("#btnPngSave").addEventListener("click", () => radarPng((b, err) => b ? savePng(b) : irToast("PNG konnte nicht erzeugt werden")));

    // ---------- Filter ----------
    function fillFilters() {
      const S = DATA.sessions; const opt = (id, vals) => { const sel = $(id); const v = [...new Set(vals.filter(Boolean))].sort(); sel.innerHTML = `<option value="">alle</option>` + v.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join(""); return v };
      const roles = [...new Set(S.flatMap(s => s.rollen))].sort(); $("#fRolle").insertAdjacentHTML("beforeend", roles.map(r => `<button class="btn small" data-rolle="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join(""));
      opt("#fBeitrag", DATA.signale.map(g => g.beitragsart)); opt("#fEvidenz", DATA.signale.map(g => g.evidenz));
      const tags = opt("#fTag", S.map(s => s.tag)); $("#lTag").hidden = tags.length < 2; const tracks = opt("#fTrack", S.map(s => s.track)); $("#lTrack").hidden = tracks.length < 2;
      const evs = opt("#fEvent", S.map(s => s.event)); $("#lEvent").hidden = evs.length < 2; if (roles.length < 2) $("#fRolle").hidden = true;
      $$("#fRolle [data-rolle]").forEach(b => b.addEventListener("click", () => { const r = b.dataset.rolle; if (state.f.rolle.has(r)) state.f.rolle.delete(r); else state.f.rolle.add(r); apply() }));
      [["#fBeitrag", "beitrag"], ["#fEvidenz", "evidenz"], ["#fTag", "tag"], ["#fTrack", "track"], ["#fEvent", "event"]].forEach(([id, k]) => $(id).addEventListener("change", e => { state.f[k] = e.target.value; apply() }));
      $("#btnReset").addEventListener("click", () => { state.f = { rolle: new Set(), beitrag: "", evidenz: "", tag: "", track: "", event: "" }; $$("#filterbar select").forEach(s => { s.value = "" }); apply() })
    }
    function apply() {
      recalc(); const f = state.f; $$("#fRolle [data-rolle]").forEach(b => { const on = f.rolle.has(b.dataset.rolle); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on) }); const chips = []; if (f.rolle.size) chips.push(`Rolle: ${[...f.rolle].join(", ")}`); if (f.beitrag) chips.push(`Beitragsart: ${f.beitrag}`); if (f.evidenz) chips.push(`Evidenz: ${f.evidenz}`); if (f.tag) chips.push(`Tag: ${f.tag}`); if (f.track) chips.push(`Track: ${f.track}`); if (f.event) chips.push(`Event: ${f.event}`);
      $("#filterinfo").innerHTML = chips.length ? `<span>Filter wirken auf Zählung, Score und Ringe:</span>${chips.map(c => `<span class="chip">${esc(c)}</span>`).join("")}` : `<span>Keine Filter aktiv – Werte entsprechen dem Methodenblatt.</span>`; render()
    }

    // ---------- Navigation (app-intern, ohne URL-Hash) ----------
    function nav(p) { Object.assign(state, p); state.alleSig = null; render() }
    function setView(v) { state.view = v; render() }
    $$("nav.views [data-view]").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
    $$("[data-sector]").forEach(b => b.addEventListener("click", () => { state.sector = b.dataset.sector; render() }));
    $$("[data-ring]").forEach(b => b.addEventListener("click", () => { if (b.disabled) return; state.ring = b.dataset.ring; render() }));
    $("#q").addEventListener("input", e => { state.q = e.target.value; drawSuche() });

    function render() {
      tipHide();
      $$("nav.views [data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
      $$("[data-sector]").forEach(b => b.classList.toggle("on", b.dataset.sector === state.sector)); $$("[data-ring]").forEach(b => b.classList.toggle("on", b.dataset.ring === state.ring));
      $("#viewRadar").hidden = state.view !== "radar"; $("#viewSessions").hidden = state.view !== "sessions"; $("#viewListe").hidden = state.view !== "liste"; $("#viewSuche").hidden = state.view !== "suche"; $("#viewMethode").hidden = state.view !== "methode";
      $("#filterbar").hidden = state.view === "methode";
      if (state.view === "radar") { drawRadar(); drawCard(); if (state.scrollCard) { state.scrollCard = false; requestAnimationFrame(() => { const c = $("#card"); if (c) { c.scrollIntoView({ block: "start", behavior: "smooth" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1200) } }) } }
      else if (state.view === "sessions") drawSessions();
      else if (state.view === "liste") drawListe();
      else if (state.view === "suche") { $("#q").value = state.q; drawSuche() }
      else drawMethode();
    }

    // ---------- Kopf, Fuß, Start ----------
    (function kopf() {
      const nm = e => { const n = e.name || e.event_id; const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(n); return m ? [m[1], m[2]] : [n, ""] };
      const datum = e => e.datum_von ? (e.datum_bis && e.datum_bis !== e.datum_von ? `${e.datum_von.slice(8, 10)}.${e.datum_von.slice(5, 7)}.–${e.datum_bis.slice(8, 10)}.${e.datum_bis.slice(5, 7)}.${e.datum_bis.slice(0, 4)}` : `${e.datum_von.slice(8, 10)}.${e.datum_von.slice(5, 7)}.${e.datum_von.slice(0, 4)}`) : "";
      const ev = EVENTS.map(e => { const [, zus] = nm(e); const d = datum(e); return [EVENTS.length > 1 ? nm(e)[0] : "", zus, d, e.ort].filter(Boolean).join(" · ") }).filter(Boolean).join(" + ");
      $("#brand").textContent = KONFIG.produktname;
      $("#eyebrow").innerHTML = `${ev ? `<span>${esc(ev)}</span>` : ""}<span>${DATA.sessions.length} Sessions · ${DATA.signale.length} Signale</span><span>Stand ${esc((DATA.stand || "").slice(0, 10))}</span><span>Codebuch v${esc(DATA.codebuch_version)}</span>`;
      $("#h1").textContent = EVENTS.map(e => nm(e)[0]).join(" + ") || DATA.titel;
      $("#lede").textContent = `${DATA.makro.filter(k => k.ist_trend).length} Makrotrends und ${(DATA.mikro || []).filter(m => m.ist_trend).length} Mikrotrends, abgeleitet aus belegten Aussagen der Sessions. Auswahl über feste Schwellen, keine redaktionelle Vorauswahl. Jede Aussage trägt Zitat und Fundstelle.`;
      $("#btnMomentum").disabled = !MULTI; if (!MULTI) $("#btnMomentum").title = "Momentum braucht mindestens zwei Events im Export";
      $("#foot").innerHTML = `<p><b>Lesart:</b> Ringe zeigen, wie breit und vielfältig ein Trend auf dem Event belegt ist (Score aus Evidenzgrad, Beitragsart, Eigeninteresse je Session, gedeckelt; Vielfaltsbonus je Absenderrolle). Sie sagen nichts über Reifegrad oder Relevanz für eine bestimmte Organisation.</p><p><b>Datenbasis:</b> ${DATA.sessions.length} Sessions, ${DATA.signale.length} Signale, Codebuch v${esc(DATA.codebuch_version)}; Details im Methodenblatt. Export <code>${esc(DATA.export_id)}</code>.</p>`;
      if (matchMedia("(max-width:900px)").matches) $("#filterbar").open = false;
      fillFilters(); apply();
    })();
  }

  return { init, oeffneQuelle, oeffneImport, oeffneArchiv, importDatei, schliessen };
})();
window.RADAR = RADAR;
