// AI Messe Guide 2026 – App-Logik
// Architektur: Seed-Daten (data.js) + Zustand in LocalStorage (aimg2026_*),
// Dateien/Bilder in IndexedDB (db.js). Reines Frontend, kein Server nötig.

"use strict";

/* ---------------- Zustand ---------------- */

const NS = "aimg2026_state_v1";

function defaultState() {
  return {
    events: JSON.parse(JSON.stringify(SEED_EVENTS)),
    users: [{ id: "u_ich", name: "Ich", email: "", stadt: "", farbe: "#818cf8", istIch: true, verifiziert: false }],
    aktiverUser: "u_ich",
    session: null,     // userId des per E-Mail angemeldeten Nutzers
    sharing: {},       // evId -> [userId] – Anmeldungen zum Präsentations-Sharing
    nachrichten: [],   // [{id, vonId, anId, text, zeit(ISO), gelesen}] – Direktnachrichten
    anmeldungen: {},   // evId -> {status, ticketTyp, preis, zahlungsart, zahlungsdatum, bestellnr, notiz}
    reisen: {},        // evId -> [{id, art, von, nach, abfahrt, ankunft, kosten, notiz}]
    uebernachtungen: {}, // evId -> [{id, name, checkin, checkout, kosten, notiz}]
    kosten: {},        // evId -> [{id, kategorie, beschreibung, betrag, datum}]
    treffen: {},       // evId -> [{id, typ, titel, ort, zeit, notiz, teilnehmer:[]}]
    mitfahrten: {},    // evId -> [{id, fahrerId, von, plaetze, abfahrt, notiz, mitfahrer:[]}]
    beitraege: {},     // evId -> [{id, userId, text, zeit}]
    notizen: {},       // evId -> [{id, titel, text, geaendert}]
    teilnehmer: {},    // evId -> [userId]
    auswahl: {},       // kandidatId -> {teilnahme: "ja"|"nein", kosten, eventId}
    bewertungen: {},   // evId -> 1..5 Sterne
    merker: {}         // evId -> true (vorgemerkt)
  };
}

let S = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(NS);
    if (raw) {
      const s = Object.assign(defaultState(), JSON.parse(raw));
      migriereSeeds(s);
      return s;
    }
  } catch (e) { console.warn("Zustand konnte nicht geladen werden:", e); }
  return Object.assign(defaultState(), { seedVersion: SEED_VERSION });
}

// Einmalige Übernahme korrigierter Seed-Termine in bestehende gespeicherte Zustände.
// Überschreibt nur Events mit seed-Flag; eigene Veranstaltungen bleiben unberührt.
function migriereSeeds(s) {
  if ((s.seedVersion || 1) >= SEED_VERSION) return;
  s.events.forEach(e => {
    if (!e.seed) return;
    const neu = SEED_EVENTS.find(x => x.id === e.id);
    if (neu) Object.assign(e, neu);
  });
  s.seedVersion = SEED_VERSION;
  localStorage.setItem(NS, JSON.stringify(s));
  console.info("Seed-Termine auf Version " + SEED_VERSION + " aktualisiert.");
}
function save() {
  localStorage.setItem(NS, JSON.stringify(S));
  if (typeof CLOUD !== "undefined" && CLOUD.aktiv()) CLOUD.zustandSpeichern();
}

const uid = () => "x" + Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtEUR = n => (Number(n) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const fmtDatum = iso => iso ? new Date(iso + "T00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
const fmtDatumKurz = iso => iso ? new Date(iso + "T00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "–";
const heute = () => new Date().toISOString().slice(0, 10);

function ev(id) { return S.events.find(e => e.id === id); }
function user(id) { return S.users.find(u => u.id === id); }
function anm(evId) { return S.anmeldungen[evId] || null; }
function listOf(map, evId) { if (!map[evId]) map[evId] = []; return map[evId]; }

function eventZeitraum(e) {
  if (e.start === e.end) return fmtDatum(e.start);
  return fmtDatumKurz(e.start) + " – " + fmtDatum(e.end);
}
function statusVon(evId) {
  const a = anm(evId);
  return a && a.status ? a.status : "Geplant";
}
const STATUS_KLASSE = { "Geplant": "st-geplant", "Interessiert": "st-geplant", "Angemeldet": "st-angemeldet", "Bezahlt": "st-bezahlt", "Besucht": "st-besucht", "Abgesagt": "st-abgesagt" };

/* ---------------- Kostenberechnung ---------------- */

function kostenZeilen(evId) {
  // Liefert alle Kostenposten eines Events als einheitliche Zeilen.
  const zeilen = [];
  const a = anm(evId);
  if (a && a.preis > 0 && a.status !== "Abgesagt") {
    zeilen.push({ kategorie: "Eintritt", beschreibung: "Ticket" + (a.ticketTyp ? " (" + a.ticketTyp + ")" : ""), betrag: Number(a.preis), datum: a.zahlungsdatum || "", quelle: "anmeldung" });
  }
  (S.reisen[evId] || []).forEach(r => {
    if (r.kosten > 0) zeilen.push({ kategorie: "Fahrtkosten", beschreibung: (VM_ICON[r.art] || "") + " " + r.art + ": " + (r.von || "?") + " → " + (r.nach || "?"), betrag: Number(r.kosten), datum: r.abfahrt ? r.abfahrt.slice(0, 10) : "", quelle: "reise" });
  });
  (S.uebernachtungen[evId] || []).forEach(u => {
    if (u.kosten > 0) zeilen.push({ kategorie: "Übernachtung", beschreibung: u.name || "Hotel", betrag: Number(u.kosten), datum: u.checkin || "", quelle: "hotel" });
  });
  (S.kosten[evId] || []).forEach(k => {
    zeilen.push({
      kategorie: k.kategorie, beschreibung: k.beschreibung, betrag: Number(k.betrag), datum: k.datum || "",
      quelle: "manuell", id: k.id,
      netto: k.netto, ust: k.ust, ustSatz: k.ustSatz, waehrung: k.waehrung, betragOriginal: k.betragOriginal, kurs: k.kurs
    });
  });
  return zeilen;
}
function kostenSumme(evId) { return kostenZeilen(evId).reduce((s, z) => s + z.betrag, 0); }
function kostenNachKategorie() {
  const sums = {};
  KOSTEN_KATEGORIEN.forEach(k => sums[k] = 0);
  S.events.forEach(e => kostenZeilen(e.id).forEach(z => { sums[z.kategorie] = (sums[z.kategorie] || 0) + z.betrag; }));
  return sums;
}
function gesamtKosten() { return S.events.reduce((s, e) => s + kostenSumme(e.id), 0); }
function kostenProEventNachKategorie(evId) {
  const s = {};
  KOSTEN_KATEGORIEN.forEach(k => s[k] = 0);
  kostenZeilen(evId).forEach(z => { s[z.kategorie] = (s[z.kategorie] || 0) + z.betrag; });
  return s;
}

/* ---------------- Kalender-Export (Google & ICS) ---------------- */

function tagNach(iso) { // Folgetag (ICS/GCal: Enddatum exklusiv bei ganztägigen Terminen); UTC, sonst Zeitzonen-Versatz
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function gcalUrl(e) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: e.start.replaceAll("-", "") + "/" + tagNach(e.end).replaceAll("-", ""),
    location: [e.venue, e.ort].filter(Boolean).join(", "),
    details: [(e.beschreibung || ""), e.url].filter(Boolean).join("\n")
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function icsEsc(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function icsDownload(events, dateiname) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AI Messe Guide 2026//DE", "CALSCALE:GREGORIAN"];
  events.forEach(e => {
    lines.push("BEGIN:VEVENT",
      "UID:" + e.id + "@aimg2026",
      "DTSTART;VALUE=DATE:" + e.start.replaceAll("-", ""),
      "DTEND;VALUE=DATE:" + tagNach(e.end).replaceAll("-", ""),
      "SUMMARY:" + icsEsc(e.name),
      "LOCATION:" + icsEsc([e.venue, e.ort].filter(Boolean).join(", ")),
      "DESCRIPTION:" + icsEsc([(e.beschreibung || ""), e.url].filter(Boolean).join(" – ")),
      "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(a.href);
}

const A = {}; // Namensraum für Inline-Handler
window.A = A;

/* ---------------- Anmeldung per E-Mail (lokaler Demo-Modus) ---------------- */
// Ohne Server kann die App keine echten Mails versenden. Der Ablauf ist derselbe
// wie bei einem Magic-Code-Login, der Code wird aber direkt angezeigt.

let pendingLogin = null; // {email, code, neu: bool}

function angemeldeter() { return S.session ? user(S.session) : null; }
function loginNoetig() {
  if (S.session) return false;
  A.loginDialog("Für diese Aktion bitte zuerst mit deiner E-Mail anmelden.");
  return true;
}

function renderLogin() {
  const el = document.getElementById("login-bereich");
  if (!el) return;
  const u = angemeldeter();
  el.innerHTML = (u ? `
    <div class="login-info">
      <span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>
      <div class="login-name">${esc(u.name)}<span>${esc(u.email || "")}</span></div>
      <button class="btn klein" onclick="A.kontoDialog()" title="Konto & Daten">⚙</button>
      <button class="btn klein" onclick="A.logout()" title="Abmelden">↩</button>
    </div>` : `
    <button class="btn primaer login-btn" onclick="A.loginDialog()">🔐 Mit E-Mail anmelden</button>
    <button class="btn klein login-btn" style="margin-top:6px" onclick="A.kontoDialog()">⚙ Konto &amp; Daten</button>`);
}

A.loginDialog = function (hinweis) {
  if (typeof CLOUD !== "undefined" && CLOUD.aktiv()) return A.cloudLoginDialog(hinweis);
  pendingLogin = null;
  openModal("Anmelden", `
    ${hinweis ? `<p class="hinweis" style="margin:0 0 12px">${esc(hinweis)}</p>` : ""}
    <form onsubmit="return A.loginEmail(event)">
      <label>E-Mail-Adresse <input type="email" name="email" required placeholder="du@example.com" autocomplete="email"></label>
      <div class="modal-aktionen"><button class="btn primaer">Weiter</button></div>
    </form>
    <p class="hinweis">Neue E-Mail-Adressen werden als neues Mitglied registriert. Demo-Modus: Der Bestätigungscode wird angezeigt statt gemailt (die App läuft ohne Server).</p>`);
};

A.loginEmail = function (evt) {
  evt.preventDefault();
  const email = String(new FormData(evt.target).get("email")).trim().toLowerCase();
  const konto = S.users.find(u => (u.email || "").toLowerCase() === email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  pendingLogin = { email, code, neu: !konto };
  openModal("Bestätigungscode", `
    <p class="hinweis" style="margin-bottom:10px">Code für <b>${esc(email)}</b> ${konto ? "" : "(neues Mitglied)"} –
      im Demo-Modus hier angezeigt; <a href="mailto:${esc(email)}?subject=${encodeURIComponent("Dein AI Messe Guide Bestätigungscode")}&body=${encodeURIComponent("Dein Code: " + code)}">per Mail-Programm senden</a>.</p>
    <div class="code-box">${code}</div>
    <form onsubmit="return A.loginCode(event)">
      ${pendingLogin.neu ? `
      <div class="form-reihe">
        <label>Dein Name <input name="name" required></label>
        <label>Stadt <input name="stadt"></label>
      </div>` : ""}
      <label>Bestätigungscode <input name="code" required inputmode="numeric" pattern="[0-9]{6}" placeholder="6-stelliger Code" autocomplete="one-time-code"></label>
      <div class="modal-aktionen"><button class="btn primaer">Anmelden</button></div>
    </form>`);
};

A.loginCode = function (evt) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  if (!pendingLogin || String(f.get("code")).trim() !== pendingLogin.code) {
    alert("Der Code stimmt nicht. Bitte erneut versuchen.");
    return false;
  }
  let konto = S.users.find(u => (u.email || "").toLowerCase() === pendingLogin.email);
  if (!konto) {
    konto = { id: uid(), name: f.get("name") || pendingLogin.email.split("@")[0], email: pendingLogin.email, stadt: f.get("stadt") || "", farbe: "#" + Math.floor(Math.random() * 0x7fffff + 0x400000).toString(16), istIch: false };
    S.users.push(konto);
  }
  konto.verifiziert = true;
  S.session = konto.id;
  S.aktiverUser = konto.id;
  pendingLogin = null;
  save(); closeModal(); render();
  return false;
};

A.logout = function () {
  S.session = null;
  save();
  if (typeof CLOUD !== "undefined" && CLOUD.aktiv()) CLOUD.abmelden().finally(render);
  else render();
};

/* ---------------- Cloud-Login (Supabase: E-Mail + Passwort + MFA) ---------------- */

A.cloudLoginDialog = function (hinweis) {
  openModal("Anmelden", `
    ${hinweis ? `<p class="hinweis" style="margin:0 0 12px">${esc(hinweis)}</p>` : ""}
    <form onsubmit="return A.cloudLogin(event)">
      <label>E-Mail-Adresse <input type="email" name="email" required autocomplete="email"></label>
      <label>Passwort <input type="password" name="passwort" required minlength="8" autocomplete="current-password"></label>
      <label class="chip waehlbar" style="display:inline-flex"><input type="checkbox" name="neu"> Neues Konto registrieren</label>
      <div class="modal-aktionen"><button class="btn primaer">Weiter</button></div>
    </form>
    <p class="hinweis">Konto und Daten liegen in deinem Supabase-Projekt (EU-Region empfohlen). Nach der Registrierung bitte den Bestätigungslink in der E-Mail anklicken. Details: <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a>.</p>`);
};

A.cloudLogin = async function (evt) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const email = String(f.get("email")).trim().toLowerCase();
  const passwort = String(f.get("passwort"));
  try {
    if (f.get("neu")) {
      await CLOUD.registrieren(email, passwort);
      openModal("Registrierung gesendet", `<p class="hinweis">Bestätigungs-E-Mail an <b>${esc(email)}</b> verschickt. Nach dem Klick auf den Link kannst du dich anmelden.</p>
        <div class="modal-aktionen"><button class="btn primaer" onclick="A.cloudLoginDialog()">Zur Anmeldung</button></div>`);
      return false;
    }
    const { mfaNoetig } = await CLOUD.anmelden(email, passwort);
    if (mfaNoetig) { A.mfaChallengeDialog(email); return false; }
    await cloudSitzungUebernehmen(email);
  } catch (err) {
    alert("Anmeldung fehlgeschlagen: " + err.message);
  }
  return false;
};

A.mfaChallengeDialog = function (email) {
  openModal("Zwei-Faktor-Authentifizierung", `
    <p class="hinweis" style="margin-bottom:12px">Dein Konto ist mit MFA geschützt. Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
    <form onsubmit="return A.mfaChallenge(event,'${esc(email)}')">
      <label>Code <input name="code" required inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code"></label>
      <div class="modal-aktionen"><button class="btn primaer">Bestätigen</button></div>
    </form>`);
};

A.mfaChallenge = async function (evt, email) {
  evt.preventDefault();
  try {
    const faktoren = await CLOUD.mfaFaktoren();
    if (!faktoren.length) throw new Error("Kein MFA-Faktor gefunden.");
    await CLOUD.mfaBestaetigen(faktoren[0].id, String(new FormData(evt.target).get("code")).trim());
    await cloudSitzungUebernehmen(email);
  } catch (err) {
    alert("MFA fehlgeschlagen: " + err.message);
  }
  return false;
};

async function cloudSitzungUebernehmen(email) {
  await CLOUD.zustandLaden(); // ersetzt ggf. den lokalen Zustand durch den Cloud-Stand
  let konto = S.users.find(u => (u.email || "").toLowerCase() === email);
  if (!konto) {
    konto = { id: uid(), name: email.split("@")[0], email, stadt: "", farbe: "#38bdf8", istIch: !S.users.some(u => u.istIch), verifiziert: true };
    S.users.push(konto);
  }
  konto.verifiziert = true;
  S.session = konto.id;
  S.aktiverUser = konto.id;
  save(); closeModal(); render();
}

A.mfaEinrichtenDialog = async function () {
  if (!CLOUD.aktiv() || !CLOUD.nutzer) { alert("MFA-Einrichtung ist nur im Cloud-Modus mit angemeldetem Konto möglich."); return; }
  try {
    const { faktorId, qr, geheimnis } = await CLOUD.mfaEinrichten();
    const qrImg = qr && qr.startsWith("data:") ? `<img src="${qr}" alt="QR-Code" style="width:180px;display:block;margin:0 auto 10px;background:#fff;padding:8px;border-radius:8px">` : "";
    openModal("MFA einrichten (Authenticator-App)", `
      ${qrImg}
      <p class="hinweis">QR-Code mit einer Authenticator-App (z. B. Google Authenticator, Aegis, 1Password) scannen oder Geheimnis manuell eingeben:</p>
      <div class="code-box" style="font-size:15px;letter-spacing:2px">${esc(geheimnis)}</div>
      <form onsubmit="return A.mfaEinrichtenBestaetigen(event,'${faktorId}')">
        <label>Code aus der App <input name="code" required inputmode="numeric" pattern="[0-9]{6}"></label>
        <div class="modal-aktionen"><button class="btn primaer">MFA aktivieren</button></div>
      </form>`);
  } catch (err) {
    alert("MFA-Einrichtung fehlgeschlagen: " + err.message);
  }
};

A.mfaEinrichtenBestaetigen = async function (evt, faktorId) {
  evt.preventDefault();
  try {
    await CLOUD.mfaBestaetigen(faktorId, String(new FormData(evt.target).get("code")).trim());
    closeModal();
    alert("MFA ist aktiv. Ab der nächsten Anmeldung wird der Code abgefragt.");
  } catch (err) {
    alert("Code ungültig: " + err.message);
  }
  return false;
};

/* ---------------- Konto & Daten (DSGVO: Export, Löschung) ---------------- */

A.kontoDialog = function () {
  const u = angemeldeter();
  const cloud = typeof CLOUD !== "undefined" && CLOUD.aktiv();
  openModal("Konto & Daten", `
    ${u ? `<p class="hinweis" style="margin-bottom:12px">Angemeldet als <b>${esc(u.name)}</b> ${u.email ? "&lt;" + esc(u.email) + "&gt;" : ""} · Modus: ${cloud ? "Cloud (Supabase)" : "lokal (nur dieser Browser)"}</p>` : `<p class="hinweis" style="margin-bottom:12px">Nicht angemeldet · Modus: ${cloud ? "Cloud (Supabase)" : "lokal (nur dieser Browser)"}</p>`}
    <div class="knopf-reihe" style="flex-direction:column;align-items:stretch">
      <button class="btn" onclick="A.datenExport()">📤 Alle Daten als JSON exportieren (Art. 20 DSGVO)</button>
      <label class="btn datei-btn" style="text-align:center">📥 Daten aus JSON-Export importieren<input type="file" accept=".json,application/json" onchange="A.datenImport(this)"></label>
      ${cloud && u ? `<button class="btn" onclick="A.mfaEinrichtenDialog()">🛡 Zwei-Faktor-Authentifizierung (MFA) einrichten</button>` : ""}
      ${u ? `<button class="btn gefahr" onclick="A.kontoLoeschen()">🗑 Mein Konto und meine Inhalte löschen (Art. 17 DSGVO)</button>` : ""}
      <button class="btn gefahr" onclick="A.allesLoeschen()">⚠️ Alle lokalen App-Daten dieses Browsers löschen</button>
    </div>
    <p class="hinweis">Rechtliches: <a href="datenschutz.html" target="_blank">Datenschutz</a> · <a href="rechtliches.html" target="_blank">Impressum &amp; EU AI Act</a></p>`);
};

A.datenExport = function () {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ai-messe-guide-datenexport.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

A.datenImport = function (input) {
  const datei = input.files[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    input.value = "";
    try {
      const daten = JSON.parse(leser.result);
      if (!Array.isArray(daten.events) || !Array.isArray(daten.users)) {
        throw new Error("Das ist keine Exportdatei des AI Messe Guide.");
      }
      if (!confirm(`Import ersetzt die aktuellen Daten (${S.events.length} Veranstaltungen, ${S.users.length} Mitglieder) durch den Dateiinhalt (${daten.events.length} Veranstaltungen, ${daten.users.length} Mitglieder). Vorher exportieren? Abbrechen = nichts passiert.`)) return;
      localStorage.setItem(NS, JSON.stringify(daten));
      S = loadState(); // inkl. Seed-Migration, falls der Export von einer älteren Version stammt
      closeModal(); render();
      alert("Import abgeschlossen. Hinweis: Dateien/Bilder (IndexedDB) sind nicht Teil des JSON-Exports.");
    } catch (e) {
      alert("Import fehlgeschlagen: " + e.message);
    }
  };
  leser.readAsText(datei);
};

A.kontoLoeschen = async function () {
  const u = angemeldeter();
  if (!u) return;
  if (!confirm(`Konto „${u.name}" und alle zugehörigen Inhalte (Beiträge, Nachrichten, Mitfahrten, eigene Dateien) unwiderruflich löschen?`)) return;
  if (!confirm("Wirklich sicher? Dieser Schritt kann nicht rückgängig gemacht werden.")) return;
  const uid_ = u.id;
  // Inhalte des Nutzers entfernen (DSGVO Art. 17)
  Object.keys(S.beitraege).forEach(k => S.beitraege[k] = S.beitraege[k].filter(b => b.userId !== uid_));
  S.nachrichten = S.nachrichten.filter(n => n.vonId !== uid_ && n.anId !== uid_);
  Object.keys(S.mitfahrten).forEach(k => {
    S.mitfahrten[k] = S.mitfahrten[k].filter(m => m.fahrerId !== uid_);
    S.mitfahrten[k].forEach(m => { const i = (m.mitfahrer || []).indexOf(uid_); if (i >= 0) m.mitfahrer.splice(i, 1); });
  });
  Object.keys(S.treffen).forEach(k => S.treffen[k].forEach(t => { const i = (t.teilnehmer || []).indexOf(uid_); if (i >= 0) t.teilnehmer.splice(i, 1); }));
  Object.keys(S.teilnehmer).forEach(k => { const i = S.teilnehmer[k].indexOf(uid_); if (i >= 0) S.teilnehmer[k].splice(i, 1); });
  Object.keys(S.sharing).forEach(k => { const i = S.sharing[k].indexOf(uid_); if (i >= 0) S.sharing[k].splice(i, 1); });
  try { // eigene Dateien aus IndexedDB
    const db = await dbOpen();
    const alle = await new Promise((res, rej) => { const r = db.transaction(DB_STORE).objectStore(DB_STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
    for (const d of alle) if (d.ownerId === uid_) await dbDeleteFile(d.id);
  } catch (e) { console.warn("Dateilöschung:", e); }
  S.users = S.users.filter(x => x.id !== uid_);
  S.session = null;
  save();
  if (typeof CLOUD !== "undefined" && CLOUD.aktiv() && CLOUD.nutzer) {
    try { await CLOUD.kontoLoeschen(); } catch (e) { alert("Cloud-Konto-Löschung fehlgeschlagen: " + e.message); }
  }
  closeModal(); render();
  alert("Konto und Inhalte wurden gelöscht.");
};

A.allesLoeschen = async function () {
  if (!confirm("ALLE lokalen Daten dieser App in diesem Browser löschen (Veranstaltungen, Kosten, Nachrichten, Dateien)?")) return;
  if (!confirm("Wirklich sicher? Die App startet danach im Auslieferungszustand.")) return;
  localStorage.removeItem(NS);
  localStorage.removeItem("aimg2026_theme");
  await new Promise(res => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = r.onblocked = res; });
  location.reload();
};

/* ---------------- Design-Umschalter (3 Themes) ---------------- */

A.theme = function (t) {
  localStorage.setItem("aimg2026_theme", t);
  const link = document.getElementById("theme-css");
  if (link) link.href = "css/theme-" + t + ".css";
  document.querySelectorAll(".theme-knopf").forEach(b => b.classList.toggle("aktiv", b.dataset.theme === t));
};

/* ---------------- Routing & Rendering ---------------- */

let route = { view: "dashboard", evId: null, tab: "uebersicht" };
let kalMonat = (() => { const d = new Date(); return { j: d.getFullYear(), m: d.getMonth() }; })();

A.nav = function (view) {
  route = { view, evId: null, tab: "uebersicht" };
  render();
};
A.openEvent = function (evId, tab) {
  route = { view: "event", evId, tab: tab || "uebersicht" };
  render();
};
A.tab = function (tab) { route.tab = tab; render(); };

function render() {
  document.querySelectorAll(".navlink").forEach(el => {
    el.classList.toggle("aktiv", el.dataset.view === route.view || (route.view === "event" && el.dataset.view === "events"));
  });
  const main = document.getElementById("main");
  switch (route.view) {
    case "dashboard": main.innerHTML = vDashboard(); break;
    case "kalender": main.innerHTML = vKalender(); break;
    case "auswahl": main.innerHTML = vAuswahl(); break;
    case "events": main.innerHTML = vEvents(); break;
    case "kosten": main.innerHTML = vKosten(); break;
    case "community": main.innerHTML = vCommunity(); break;
    case "nachrichten": main.innerHTML = vNachrichten(); break;
    case "event": main.innerHTML = vEventDetail(); nachladenMaterialien(); break;
    default: main.innerHTML = vDashboard();
  }
  renderLogin();
  renderDmBadge();
  const verlauf = document.getElementById("dm-verlauf");
  if (verlauf) verlauf.scrollTop = verlauf.scrollHeight;
  if (sucheFokus) {
    const sf = document.getElementById("suchfeld");
    if (sf) { sf.focus(); sf.setSelectionRange(sf.value.length, sf.value.length); }
    sucheFokus = false;
  }
  main.scrollTop = 0;
}

/* ---------------- Ansicht: Dashboard ---------------- */

function vDashboard() {
  const jetzt = heute();
  const kommend = S.events.filter(e => e.end >= jetzt && statusVon(e.id) !== "Abgesagt").sort((a, b) => a.start.localeCompare(b.start));
  const angemeldet = S.events.filter(e => ["Angemeldet", "Bezahlt", "Besucht"].includes(statusVon(e.id)));
  const naechste = kommend[0];
  let countdown = "";
  if (naechste) {
    const tage = Math.ceil((new Date(naechste.start) - new Date(jetzt)) / 86400000);
    countdown = tage <= 0 ? "läuft gerade!" : "in " + tage + " Tag" + (tage === 1 ? "" : "en");
  }
  const sums = kostenNachKategorie();
  const max = Math.max(...Object.values(sums), 1);

  return `
  <div class="kopf"><h1>Dashboard</h1><p class="unter">Deine AI-Messen, Konferenzen &amp; Reisen 2026 im Überblick</p></div>
  <div class="kpi-reihe">
    <div class="kpi"><div class="kpi-wert">${S.events.length}</div><div class="kpi-label">Veranstaltungen</div></div>
    <div class="kpi"><div class="kpi-wert">${angemeldet.length}</div><div class="kpi-label">Angemeldet / besucht</div></div>
    <div class="kpi"><div class="kpi-wert">${fmtEUR(gesamtKosten())}</div><div class="kpi-label">Gesamtkosten 2026</div></div>
    <div class="kpi akzent"><div class="kpi-wert">${naechste ? esc(naechste.kurz || naechste.name) : "–"}</div><div class="kpi-label">${naechste ? "Nächste Veranstaltung " + countdown : "Keine anstehend"}</div></div>
  </div>
  <div class="kpi-reihe">
    <div class="kpi"><div class="kpi-wert">${fmtEUR(sums["Eintritt"])}</div><div class="kpi-label">davon Eintritt</div></div>
    <div class="kpi"><div class="kpi-wert">${fmtEUR(sums["Fahrtkosten"])}</div><div class="kpi-label">davon Fahrtkosten</div></div>
    <div class="kpi"><div class="kpi-wert">${fmtEUR(sums["Übernachtung"])}</div><div class="kpi-label">davon Übernachtung</div></div>
    <div class="kpi"><div class="kpi-wert">${fmtEUR(sums["Verpflegung"] + sums["Sonstiges"])}</div><div class="kpi-label">davon Verpflegung &amp; Sonstiges</div></div>
  </div>
  ${vKostenAufteilung()}
  ${(() => {
    const offen = AUSWAHL_KANDIDATEN.filter(k => !kandidatTeilnahme(k.id) && k.end >= jetzt).length;
    return offen ? `
    <div class="karte banner">
      <span>📋 In der Auswahlliste warten <b>${offen} Veranstaltungen</b> auf deine Teilnahme-Entscheidung.</span>
      <button class="btn primaer klein" onclick="A.nav('auswahl')">Jetzt entscheiden →</button>
    </div>` : "";
  })()}
  <div class="spalten">
    <div class="karte">
      <div class="karte-kopf"><h2>Anstehende Veranstaltungen</h2><button class="btn klein" onclick="A.nav('kalender')">Kalender →</button></div>
      ${kommend.slice(0, 5).map(e => zeileEvent(e)).join("") || '<p class="leer">Keine anstehenden Veranstaltungen.</p>'}
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2>Kosten nach Kategorie</h2><button class="btn klein" onclick="A.nav('kosten')">Details →</button></div>
      ${KOSTEN_KATEGORIEN.map(k => `
        <div class="balken-zeile">
          <span class="balken-label">${k}</span>
          <div class="balken-spur"><div class="balken" style="width:${Math.round(sums[k] / max * 100)}%"></div></div>
          <span class="balken-wert">${fmtEUR(sums[k])}</span>
        </div>`).join("")}
    </div>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>Letzte Beiträge aus der Community</h2><button class="btn klein" onclick="A.nav('community')">Community →</button></div>
    ${letzteBeitraege(4).map(b => `
      <div class="beitrag klein">
        <span class="avatar" style="background:${user(b.userId)?.farbe || '#666'}">${esc((user(b.userId)?.name || "?")[0])}</span>
        <div><div class="beitrag-meta"><b>${esc(user(b.userId)?.name || "Unbekannt")}</b> zu <a href="#" onclick="A.openEvent('${b.evId}','community');return false">${esc(ev(b.evId)?.kurz || "?")}</a> · ${esc(b.zeit)}</div>
        <div>${esc(b.text)}</div></div>
      </div>`).join("") || '<p class="leer">Noch keine Beiträge – starte den Austausch im Community-Tab einer Veranstaltung.</p>'}
  </div>`;
}

function vKostenAufteilung() {
  const mitKosten = S.events
    .map(e => ({ e, s: kostenProEventNachKategorie(e.id), summe: kostenSumme(e.id) }))
    .filter(x => x.summe > 0)
    .sort((a, b) => b.summe - a.summe);
  if (!mitKosten.length) return "";
  const tot = {};
  KOSTEN_KATEGORIEN.forEach(k => tot[k] = mitKosten.reduce((s, x) => s + x.s[k], 0));
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Kostenaufteilung je Veranstaltung</h2><button class="btn klein" onclick="A.nav('kosten')">Alle Posten →</button></div>
    <table class="tabelle">
      <thead><tr><th>Veranstaltung</th><th class="rechts">Eintritt</th><th class="rechts">Fahrtkosten</th><th class="rechts">Übernachtung</th><th class="rechts">Verpflegung</th><th class="rechts">Sonstiges</th><th class="rechts">Gesamt</th></tr></thead>
      <tbody>
        ${mitKosten.map(({ e, s, summe }) => `
        <tr>
          <td><a href="#" onclick="A.openEvent('${e.id}','kosten');return false">${esc(e.kurz || e.name)}</a></td>
          <td class="rechts">${s["Eintritt"] ? fmtEUR(s["Eintritt"]) : "–"}</td>
          <td class="rechts">${s["Fahrtkosten"] ? fmtEUR(s["Fahrtkosten"]) : "–"}</td>
          <td class="rechts">${s["Übernachtung"] ? fmtEUR(s["Übernachtung"]) : "–"}</td>
          <td class="rechts">${s["Verpflegung"] ? fmtEUR(s["Verpflegung"]) : "–"}</td>
          <td class="rechts">${s["Sonstiges"] ? fmtEUR(s["Sonstiges"]) : "–"}</td>
          <td class="rechts"><b>${fmtEUR(summe)}</b></td>
        </tr>`).join("")}
        <tr class="summen-zeile">
          <td><b>Summe</b></td>
          ${KOSTEN_KATEGORIEN.map(k => `<td class="rechts"><b>${fmtEUR(tot[k])}</b></td>`).join("")}
          <td class="rechts"><b>${fmtEUR(gesamtKosten())}</b></td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

function letzteBeitraege(n) {
  const alle = [];
  Object.entries(S.beitraege).forEach(([evId, arr]) => arr.forEach(b => alle.push({ ...b, evId })));
  return alle.sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, n);
}

function zeileEvent(e) {
  const st = statusVon(e.id);
  const bw = S.bewertungen[e.id] || 0;
  return `
  <div class="event-zeile" onclick="A.openEvent('${e.id}')">
    <span class="punkt" style="background:${e.farbe}"></span>
    <div class="ez-mitte">
      <div class="ez-name">${S.merker[e.id] ? "🔖 " : ""}${esc(e.name)}</div>
      <div class="ez-sub">${eventZeitraum(e)} · ${esc(e.ort)}${bw ? ' · <span class="sterne-mini">' + "★".repeat(bw) + "</span>" : ""}</div>
    </div>
    <span class="status ${STATUS_KLASSE[st]}">${st}</span>
    <button class="btn klein" onclick="event.stopPropagation();A.eventDetails('${e.id}')">Details</button>
  </div>`;
}

/* ---- Detail-Popup mit Bewertung, Teilnahme, Merker ---- */

A.eventDetails = function (evId) {
  const e = ev(evId);
  if (!e) return;
  const a = anm(evId) || {};
  const s = kostenProEventNachKategorie(evId);
  const summe = kostenSumme(evId);
  const bw = S.bewertungen[evId] || 0;
  const st = statusVon(evId);
  openModal(e.name, `
    <table class="info-tabelle">
      <tr><td>Datum</td><td>${eventZeitraum(e)}</td></tr>
      <tr><td>Ort</td><td>${esc(e.ort)}${e.venue ? " – " + esc(e.venue) : ""}</td></tr>
      <tr><td>Status</td><td><span class="status ${STATUS_KLASSE[st]}">${st}</span></td></tr>
      <tr><td>Kosten</td><td><b>${fmtEUR(summe || (Number(a.preis ?? e.preis) || 0))}</b>
        ${summe ? `<div class="ez-sub">Eintritt ${fmtEUR(s["Eintritt"])} · Fahrt ${fmtEUR(s["Fahrtkosten"])} · Übernachtung ${fmtEUR(s["Übernachtung"])} · Verpflegung/Sonstiges ${fmtEUR(s["Verpflegung"] + s["Sonstiges"])}</div>` : `<div class="ez-sub">Ticketpreis (noch keine Posten erfasst)</div>`}</td></tr>
      <tr><td>Inhalt</td><td>${esc(e.beschreibung) || "–"}</td></tr>
      ${e.url ? `<tr><td>Website</td><td><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a></td></tr>` : ""}
      <tr><td>Bewertung</td><td class="sterne">
        ${[1, 2, 3, 4, 5].map(n => `<button class="stern ${n <= bw ? "voll" : ""}" onclick="A.bewerten('${evId}',${n})" title="${n} von 5">★</button>`).join("")}
        ${bw ? `<span class="ez-sub" style="margin-left:8px">${bw}/5</span>` : ""}
      </td></tr>
      <tr><td>Teilnahme</td><td>
        <button class="btn klein ja-btn ${["Angemeldet", "Bezahlt", "Besucht"].includes(st) ? "gewaehlt-ja" : ""}" onclick="A.zusage('${evId}',true)">✓ Ja</button>
        <button class="btn klein nein-btn ${st === "Abgesagt" ? "gewaehlt-nein" : ""}" onclick="A.zusage('${evId}',false)">✕ Nein</button>
      </td></tr>
      <tr><td>Merker</td><td>
        <button class="btn klein ${S.merker[evId] ? "gewaehlt-ja ja-btn" : ""}" onclick="A.merkerToggle('${evId}')">${S.merker[evId] ? "🔖 vorgemerkt" : "🔖 vormerken"}</button>
      </td></tr>
    </table>
    <div class="modal-aktionen">
      <a class="btn" href="${gcalUrl(e)}" target="_blank" rel="noopener">📆 Google Kalender</a>
      <button class="btn primaer" onclick="closeModal();A.openEvent('${evId}')">Zur Veranstaltung →</button>
    </div>`);
};

A.bewerten = function (evId, n) {
  S.bewertungen[evId] = (S.bewertungen[evId] === n) ? 0 : n; // gleicher Stern = zurücksetzen
  save(); render(); A.eventDetails(evId);
};

A.zusage = function (evId, ja) {
  const a = S.anmeldungen[evId] || {};
  if (ja) {
    if (!["Bezahlt", "Besucht"].includes(a.status)) a.status = "Angemeldet";
    if (!a.preis) a.preis = Number(ev(evId)?.preis) || 0;
  } else {
    a.status = "Abgesagt";
  }
  S.anmeldungen[evId] = a;
  save(); render(); A.eventDetails(evId);
};

A.merkerToggle = function (evId) {
  if (S.merker[evId]) delete S.merker[evId]; else S.merker[evId] = true;
  save(); render(); A.eventDetails(evId);
};

/* ---------------- Ansicht: Kalender ---------------- */

A.kalNav = function (delta) {
  kalMonat.m += delta;
  if (kalMonat.m < 0) { kalMonat.m = 11; kalMonat.j--; }
  if (kalMonat.m > 11) { kalMonat.m = 0; kalMonat.j++; }
  render();
};

function vKalender() {
  const { j, m } = kalMonat;
  const monatsName = new Date(j, m, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const erster = new Date(j, m, 1);
  const startWt = (erster.getDay() + 6) % 7; // Mo=0
  const tageImMonat = new Date(j, m + 1, 0).getDate();
  const zellen = [];
  for (let i = 0; i < startWt; i++) zellen.push("<div class='kal-zelle leer'></div>");
  for (let t = 1; t <= tageImMonat; t++) {
    const iso = j + "-" + String(m + 1).padStart(2, "0") + "-" + String(t).padStart(2, "0");
    const heutig = iso === heute() ? " heutig" : "";
    const tages = S.events.filter(e => e.start <= iso && e.end >= iso);
    zellen.push(`<div class="kal-zelle${heutig}"><div class="kal-tag">${t}</div>
      ${tages.slice(0, 3).map(e => `<div class="kal-chip" style="--f:${e.farbe}" onclick="A.openEvent('${e.id}')" title="${esc(e.name)}">${esc(e.kurz || e.name)}</div>`).join("")}
      ${tages.length > 3 ? `<div class="kal-mehr">+${tages.length - 3} weitere</div>` : ""}
    </div>`);
  }
  const imJahr = S.events.filter(e => e.start.startsWith(String(j))).sort((a, b) => a.start.localeCompare(b.start));
  return `
  <div class="kopf"><h1>Veranstaltungskalender</h1><p class="unter">Alle Termine im Monats- und Jahresüberblick</p></div>
  <div class="karte">
    <div class="kal-kopf">
      <button class="btn" onclick="A.kalNav(-1)">‹</button>
      <h2>${monatsName}</h2>
      <button class="btn" onclick="A.kalNav(1)">›</button>
    </div>
    <div class="kal-wochentage">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(w => `<div>${w}</div>`).join("")}</div>
    <div class="kal-gitter">${zellen.join("")}</div>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>Jahresliste ${j}</h2><button class="btn primaer klein" onclick="A.eventFormular()">+ Veranstaltung</button></div>
    ${imJahr.map(e => zeileEvent(e)).join("") || '<p class="leer">Keine Veranstaltungen in diesem Jahr.</p>'}
  </div>`;
}

/* ---------------- Ansicht: Auswahlliste ---------------- */

let auswahlFilter = { jahr: "alle", status: "alle" };
A.setAuswahlFilter = function (feld, wert) { auswahlFilter[feld] = wert; render(); };

function kandidat(kid) { return AUSWAHL_KANDIDATEN.find(k => k.id === kid); }
function kandidatKosten(k) { return S.auswahl[k.id]?.kosten ?? k.kosten; }
function kandidatTeilnahme(kid) { return S.auswahl[kid]?.teilnahme || ""; }

function vAuswahl() {
  let liste = [...AUSWAHL_KANDIDATEN].sort((a, b) => a.start.localeCompare(b.start));
  if (auswahlFilter.jahr !== "alle") liste = liste.filter(k => k.start.startsWith(auswahlFilter.jahr));
  if (auswahlFilter.status === "offen") liste = liste.filter(k => !kandidatTeilnahme(k.id));
  else if (auswahlFilter.status !== "alle") liste = liste.filter(k => kandidatTeilnahme(k.id) === auswahlFilter.status);
  const ja = AUSWAHL_KANDIDATEN.filter(k => kandidatTeilnahme(k.id) === "ja");
  const jaSumme = ja.reduce((s, k) => s + (Number(kandidatKosten(k)) || 0), 0);
  return `
  <div class="kopf"><h1>Auswahlliste AI-Veranstaltungen</h1>
    <p class="unter">2025 &amp; 2026 – aus Web-Recherche und deinem Google-Kalender. Teilnahme wählen, Kosten anpassen – „Ja" übernimmt die Veranstaltung in die App.</p></div>
  <div class="kpi-reihe">
    <div class="kpi"><div class="kpi-wert">${AUSWAHL_KANDIDATEN.length}</div><div class="kpi-label">Kandidaten gesamt</div></div>
    <div class="kpi"><div class="kpi-wert">${ja.length}</div><div class="kpi-label">Teilnahme: Ja</div></div>
    <div class="kpi"><div class="kpi-wert">${AUSWAHL_KANDIDATEN.filter(k => kandidatTeilnahme(k.id) === "nein").length}</div><div class="kpi-label">Teilnahme: Nein</div></div>
    <div class="kpi akzent"><div class="kpi-wert">${fmtEUR(jaSumme)}</div><div class="kpi-label">Ticketkosten der Zusagen</div></div>
  </div>
  <div class="werkzeuge">
    <div class="filter-gruppe">
      ${["alle", "2025", "2026"].map(j => `<button class="filter ${auswahlFilter.jahr === j ? 'aktiv' : ''}" onclick="A.setAuswahlFilter('jahr','${j}')">${j === "alle" ? "Alle Jahre" : j}</button>`).join("")}
      <span style="width:14px"></span>
      ${[["alle", "Alle"], ["offen", "Offen"], ["ja", "Ja"], ["nein", "Nein"]].map(([w, l]) => `<button class="filter ${auswahlFilter.status === w ? 'aktiv' : ''}" onclick="A.setAuswahlFilter('status','${w}')">${l}</button>`).join("")}
    </div>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>Kandidaten</h2><button class="btn klein" onclick="A.icsZusagen()">⬇ .ics aller Zusagen (Google-Kalender-Import)</button></div>
    <table class="tabelle auswahl-tabelle">
      <thead><tr><th>Termin</th><th>Veranstaltung</th><th>Ort</th><th>Quelle</th><th class="rechts">Kosten (€)</th><th>Teilnahme</th></tr></thead>
      <tbody>
      ${liste.map(k => {
        const t = kandidatTeilnahme(k.id);
        const vorbei = k.end < heute();
        const verknuepft = S.auswahl[k.id]?.eventId && ev(S.auswahl[k.id].eventId);
        return `
        <tr class="${t === 'nein' ? 'gedimmt' : ''}">
          <td class="nowrap">${eventZeitraum(k)}${vorbei ? ' <span class="tag">vorbei</span>' : ""}</td>
          <td><b>${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.name)}</a>` : esc(k.name)}</b>
            ${k.venue ? `<div class="ez-sub">${esc(k.venue)}</div>` : ""}
            ${verknuepft ? `<div class="ez-sub">→ <a href="#" onclick="A.openEvent('${S.auswahl[k.id].eventId}');return false">in der App geöffnet</a></div>` : ""}</td>
          <td>${esc(k.ort)}</td>
          <td><span class="tag ${k.quelle === 'Google-Kalender' ? 'aktiv-tag' : ''}">${k.quelle === 'Google-Kalender' ? '📆 Kalender' : '🔎 Recherche'}</span></td>
          <td class="rechts"><input type="number" class="kosten-feld" min="0" step="1" value="${kandidatKosten(k)}" onchange="A.auswahlKosten('${k.id}',this.value)"></td>
          <td class="nowrap">
            <button class="btn klein ja-btn ${t === 'ja' ? 'gewaehlt-ja' : ''}" onclick="A.teilnahme('${k.id}','ja')">✓ Ja</button>
            <button class="btn klein nein-btn ${t === 'nein' ? 'gewaehlt-nein' : ''}" onclick="A.teilnahme('${k.id}','nein')">✕ Nein</button>
            <a class="btn klein" href="${gcalUrl(k)}" target="_blank" rel="noopener" title="In Google Kalender eintragen">📆</a>
          </td>
        </tr>`;
      }).join("") || '<tr><td colspan="6" class="leer">Keine Kandidaten für diesen Filter.</td></tr>'}
      </tbody>
    </table>
    <p class="hinweis">Quelle „📆 Kalender": aus deinem Google-Kalender (inkl. Abos „KI-Café" und „AI xpress"). Quelle „🔎 Recherche": Web-Recherche Juli 2026 – Termine und Preise vor Buchung auf der verlinkten Website prüfen. Bei „Ja" wird die Veranstaltung mit Status „Interessiert" und dem Kostenwert als Ticketpreis in die App übernommen; bei „Nein" wird eine automatisch übernommene Veranstaltung wieder entfernt (bereits erfasste Daten bleiben erhalten, dann Status „Abgesagt").</p>
  </div>`;
}

function eventHatDaten(evId) {
  return ["reisen", "uebernachtungen", "kosten", "treffen", "mitfahrten", "beitraege", "notizen"].some(k => (S[k][evId] || []).length) || (S.teilnehmer[evId] || []).length > 0;
}

A.teilnahme = function (kid, wert) {
  const k = kandidat(kid);
  if (!k) return;
  const a = S.auswahl[kid] || (S.auswahl[kid] = {});
  a.teilnahme = wert;
  const preis = Number(kandidatKosten(k)) || 0;
  if (wert === "ja") {
    let zielId = (a.eventId && ev(a.eventId)) ? a.eventId : (k.eventId && ev(k.eventId)) ? k.eventId : null;
    if (!zielId) {
      zielId = "evk_" + kid;
      if (!ev(zielId)) S.events.push({
        id: zielId, name: k.name, kurz: k.name.split(" ").slice(0, 2).join(" "), kategorie: "Konferenz",
        ort: k.ort, venue: k.venue, start: k.start, end: k.end, preis, farbe: "#22d3ee",
        url: k.url, beschreibung: "Aus der Auswahlliste übernommen (Quelle: " + k.quelle + ").", land: "DE", vonAuswahl: true
      });
    }
    a.eventId = zielId;
    const anmeldung = S.anmeldungen[zielId] || {};
    if (!anmeldung.status || anmeldung.status === "Abgesagt") anmeldung.status = "Interessiert";
    if (!anmeldung.preis) anmeldung.preis = preis;
    S.anmeldungen[zielId] = anmeldung;
  } else if (a.eventId) {
    const e = ev(a.eventId);
    if (e?.vonAuswahl && !eventHatDaten(a.eventId)) {
      S.events = S.events.filter(x => x.id !== a.eventId);
      delete S.anmeldungen[a.eventId];
      delete a.eventId;
    } else if (e) {
      S.anmeldungen[a.eventId] = Object.assign(S.anmeldungen[a.eventId] || {}, { status: "Abgesagt" });
    }
  }
  save(); render();
};

A.icsZusagen = function () {
  const zusagen = AUSWAHL_KANDIDATEN.filter(k => kandidatTeilnahme(k.id) === "ja");
  if (!zusagen.length) { alert("Noch keine Zusagen in der Auswahlliste."); return; }
  icsDownload(zusagen, "ai-veranstaltungen-zusagen.ics");
};

A.icsEvent = function (evId) {
  const e = ev(evId);
  if (e) icsDownload([e], (e.kurz || e.name).replace(/[^\wäöüÄÖÜß-]+/g, "_") + ".ics");
};

A.auswahlKosten = function (kid, wert) {
  const a = S.auswahl[kid] || (S.auswahl[kid] = {});
  a.kosten = Number(wert) || 0;
  if (a.teilnahme === "ja" && a.eventId && S.anmeldungen[a.eventId]) {
    S.anmeldungen[a.eventId].preis = a.kosten;
  }
  save(); render();
};

/* ---------------- Ansicht: Veranstaltungen ---------------- */

let eventFilter = "alle";
let eventSuche = "";
let sucheFokus = false;
A.setEventFilter = function (f) { eventFilter = f; render(); };
A.suche = function (wert) { eventSuche = wert; sucheFokus = true; render(); };

function passtZurSuche(e, q) {
  return [e.name, e.kurz, e.ort, e.venue, e.kategorie, e.beschreibung].filter(Boolean).join(" ").toLowerCase().includes(q);
}

function vEvents() {
  let liste = [...S.events].sort((a, b) => a.start.localeCompare(b.start));
  if (eventFilter === "kommend") liste = liste.filter(e => e.end >= heute());
  else if (eventFilter !== "alle") liste = liste.filter(e => statusVon(e.id) === eventFilter);
  const q = eventSuche.trim().toLowerCase();
  if (q) liste = liste.filter(e => passtZurSuche(e, q));
  const kandidatenTreffer = q ? AUSWAHL_KANDIDATEN.filter(k => passtZurSuche(k, q) && !(S.auswahl[k.id]?.eventId && ev(S.auswahl[k.id].eventId))) : [];
  const filter = ["alle", "kommend", "Angemeldet", "Bezahlt", "Besucht"];
  return `
  <div class="kopf"><h1>Veranstaltungen</h1><p class="unter">AI-Messen &amp; Konferenzen verwalten – anmelden, bezahlen, planen</p></div>
  <div class="werkzeuge">
    <input id="suchfeld" class="suchfeld" placeholder="🔍 Messe suchen – Name, Ort, Thema…" value="${esc(eventSuche)}" oninput="A.suche(this.value)">
    <div class="filter-gruppe">${filter.map(f => `<button class="filter ${eventFilter === f ? 'aktiv' : ''}" onclick="A.setEventFilter('${f}')">${f === "alle" ? "Alle" : f === "kommend" ? "Anstehend" : f}</button>`).join("")}</div>
    <button class="btn primaer" onclick="A.eventFormular()">+ Neue Veranstaltung</button>
  </div>
  ${kandidatenTreffer.length ? `
  <div class="karte banner">
    <span>🔎 <b>${kandidatenTreffer.length} Treffer</b> in der Auswahlliste: ${kandidatenTreffer.slice(0, 3).map(k => esc(k.name)).join(", ")}${kandidatenTreffer.length > 3 ? "…" : ""}</span>
    <button class="btn klein" onclick="A.nav('auswahl')">Zur Auswahlliste →</button>
  </div>` : ""}
  <div class="event-gitter">
    ${liste.map(e => {
      const st = statusVon(e.id);
      const teiln = (S.teilnehmer[e.id] || []).length;
      return `
      <div class="event-karte" onclick="A.openEvent('${e.id}')">
        <div class="ek-band" style="background:${e.farbe}"></div>
        <div class="ek-inhalt">
          <div class="ek-kopf"><span class="tag">${esc(e.kategorie)}</span><span class="status ${STATUS_KLASSE[st]}">${st}</span></div>
          <h3>${esc(e.name)}</h3>
          <div class="ek-meta">📅 ${eventZeitraum(e)}</div>
          <div class="ek-meta">📍 ${esc(e.ort)}${e.venue ? " · " + esc(e.venue) : ""}</div>
          <div class="ek-fuss">
            <span>${kostenSumme(e.id) > 0 ? fmtEUR(kostenSumme(e.id)) : (e.preis > 0 ? "ab " + fmtEUR(e.preis) : "kostenlos")}</span>
            <span>${S.merker[e.id] ? "🔖 " : ""}${S.bewertungen[e.id] ? '<span class="sterne-mini">' + "★".repeat(S.bewertungen[e.id]) + "</span> " : ""}${teiln > 0 ? "👥 " + teiln : ""}</span>
          </div>
        </div>
      </div>`;
    }).join("") || '<p class="leer">Keine Veranstaltungen für diesen Filter.</p>'}
  </div>`;
}

/* ---- Veranstaltung anlegen/bearbeiten ---- */

A.eventFormular = function (evId) {
  const e = evId ? ev(evId) : null;
  openModal(e ? "Veranstaltung bearbeiten" : "Neue Veranstaltung", `
    <form onsubmit="return A.eventSpeichern(event,'${evId || ""}')">
      <label>Name <input name="name" required value="${esc(e?.name || "")}"></label>
      <div class="form-reihe">
        <label>Kurzname <input name="kurz" value="${esc(e?.kurz || "")}"></label>
        <label>Kategorie <select name="kategorie">${["Messe", "Konferenz", "Kongress", "Festival", "Summit", "Meetup"].map(k => `<option ${e?.kategorie === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
      </div>
      <div class="form-reihe">
        <label>Ort <input name="ort" required value="${esc(e?.ort || "")}"></label>
        <label>Venue <input name="venue" value="${esc(e?.venue || "")}"></label>
      </div>
      <div class="form-reihe">
        <label>Beginn <input type="date" name="start" required value="${e?.start || ""}"></label>
        <label>Ende <input type="date" name="end" required value="${e?.end || ""}"></label>
      </div>
      <div class="form-reihe">
        <label>Ticketpreis (€) <input type="number" step="0.01" min="0" name="preis" value="${e?.preis ?? ""}"></label>
        <label>Farbe <input type="color" name="farbe" value="${e?.farbe || "#818cf8"}"></label>
      </div>
      <label>Website <input name="url" value="${esc(e?.url || "")}"></label>
      <label>Beschreibung <textarea name="beschreibung" rows="3">${esc(e?.beschreibung || "")}</textarea></label>
      <div class="modal-aktionen">
        ${e ? `<button type="button" class="btn gefahr" onclick="A.eventLoeschen('${e.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.eventSpeichern = function (evt, evId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = {
    name: f.get("name"), kurz: f.get("kurz") || f.get("name"), kategorie: f.get("kategorie"),
    ort: f.get("ort"), venue: f.get("venue"), start: f.get("start"), end: f.get("end") || f.get("start"),
    preis: Number(f.get("preis")) || 0, farbe: f.get("farbe"), url: f.get("url"), beschreibung: f.get("beschreibung"), land: "DE"
  };
  if (daten.end < daten.start) daten.end = daten.start;
  if (evId) Object.assign(ev(evId), daten);
  else S.events.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.eventLoeschen = function (evId) {
  if (!confirm("Veranstaltung inklusive aller Reisen, Kosten und Notizen löschen?")) return;
  S.events = S.events.filter(e => e.id !== evId);
  ["anmeldungen", "reisen", "uebernachtungen", "kosten", "treffen", "mitfahrten", "beitraege", "notizen", "teilnehmer"].forEach(k => delete S[k][evId]);
  save(); closeModal();
  route = { view: "events", evId: null, tab: "uebersicht" };
  render();
};

/* ---------------- Ansicht: Kosten (global) ---------------- */

function vKosten() {
  const sums = kostenNachKategorie();
  const max = Math.max(...Object.values(sums), 1);
  const gesamt = gesamtKosten();
  const mitKosten = S.events.map(e => ({ e, zeilen: kostenZeilen(e.id), summe: kostenSumme(e.id) })).filter(x => x.zeilen.length).sort((a, b) => b.summe - a.summe);
  return `
  <div class="kopf"><h1>Kosten &amp; Budget</h1><p class="unter">Eintritt, Fahrt, Übernachtung und Verpflegung über alle Veranstaltungen</p></div>
  <div class="kpi-reihe">
    <div class="kpi akzent"><div class="kpi-wert">${fmtEUR(gesamt)}</div><div class="kpi-label">Gesamtkosten</div></div>
    ${KOSTEN_KATEGORIEN.slice(0, 3).map(k => `<div class="kpi"><div class="kpi-wert">${fmtEUR(sums[k])}</div><div class="kpi-label">${k}</div></div>`).join("")}
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>Verteilung nach Kategorie</h2><button class="btn" onclick="A.csvExport()">⬇ CSV-Export</button></div>
    ${KOSTEN_KATEGORIEN.map(k => `
      <div class="balken-zeile">
        <span class="balken-label">${k}</span>
        <div class="balken-spur"><div class="balken" style="width:${Math.round(sums[k] / max * 100)}%"></div></div>
        <span class="balken-wert">${fmtEUR(sums[k])}</span>
      </div>`).join("")}
  </div>
  ${mitKosten.map(({ e, zeilen, summe }) => `
    <div class="karte">
      <div class="karte-kopf">
        <h2><a href="#" onclick="A.openEvent('${e.id}','kosten');return false">${esc(e.name)}</a></h2>
        <b>${fmtEUR(summe)}</b>
      </div>
      <table class="tabelle">
        <thead><tr><th>Kategorie</th><th>Beschreibung</th><th>Datum</th><th class="rechts">Netto</th><th class="rechts">USt</th><th class="rechts">Brutto (EUR)</th></tr></thead>
        <tbody>${zeilen.map(z => `<tr><td><span class="tag">${z.kategorie}</span></td><td>${esc(z.beschreibung)}</td><td>${fmtDatum(z.datum)}</td><td class="rechts">${z.netto != null ? fmtEUR(z.netto) : "–"}</td><td class="rechts">${z.ust != null ? fmtEUR(z.ust) : "–"}</td><td class="rechts">${fmtEUR(z.betrag)}${z.waehrung && z.waehrung !== "EUR" ? ` <span class="ez-sub">(${(z.betragOriginal ?? 0).toLocaleString("de-DE")} ${esc(z.waehrung)})</span>` : ""}</td></tr>`).join("")}</tbody>
      </table>
    </div>`).join("") || '<div class="karte"><p class="leer">Noch keine Kosten erfasst. Öffne eine Veranstaltung und erfasse Anmeldung, Reise oder weitere Posten.</p></div>'}`;
}

A.csvExport = function () {
  const zahl = n => n == null ? "" : String(n).replace(".", ",");
  const zeilen = [["Veranstaltung", "Kategorie", "Beschreibung", "Datum", "Netto (EUR)", "USt (EUR)", "USt-Satz (%)", "Brutto (EUR)", "Währung", "Betrag Original", "Kurs"]];
  S.events.forEach(e => kostenZeilen(e.id).forEach(z =>
    zeilen.push([e.name, z.kategorie, z.beschreibung, z.datum, zahl(z.netto), zahl(z.ust), zahl(z.ustSatz), zahl(z.betrag), z.waehrung || "EUR", zahl(z.betragOriginal ?? z.betrag), zahl(z.kurs ?? 1)])));
  const csv = zeilen.map(r => r.map(c => '"' + String(c ?? "").replace(/"/g, '""') + '"').join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ai-messe-kosten-2026.csv";
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ---------------- Ansicht: Community ---------------- */

function vCommunity() {
  const alleMitfahrten = [];
  Object.entries(S.mitfahrten).forEach(([evId, arr]) => arr.forEach(m => alleMitfahrten.push({ ...m, evId })));
  const alleTreffen = [];
  Object.entries(S.treffen).forEach(([evId, arr]) => arr.forEach(t => alleTreffen.push({ ...t, evId })));
  return `
  <div class="kopf"><h1>Community</h1><p class="unter">Profile, Mitfahrgelegenheiten und gemeinsame Treffen</p></div>
  <div class="karte">
    <div class="karte-kopf"><h2>Mitglieder &amp; Kurzprofile (${S.users.length})</h2><button class="btn primaer klein" onclick="A.userFormular()">+ Mitglied</button></div>
    <div class="profil-gitter">
      ${S.users.map(u => profilKarte(u)).join("")}
    </div>
    <p class="hinweis">Profil per ✎ pflegen: Interessen, Fähigkeiten, aktuelles Projekt sowie „Suche/Biete" für gezieltes Netzwerken auf der Messe. Beiträge, Treffen, Mitfahrten und Nachrichten laufen über den per E-Mail angemeldeten Nutzer.</p>
  </div>
  <div class="spalten">
    <div class="karte">
      <div class="karte-kopf"><h2>Mitfahrgelegenheiten</h2></div>
      ${alleMitfahrten.map(m => mitfahrtZeile(m, m.evId, true)).join("") || '<p class="leer">Keine Mitfahrgelegenheiten. Biete eine im Community-Tab einer Veranstaltung an.</p>'}
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2>Geplante Treffen</h2></div>
      ${alleTreffen.sort((a, b) => (a.zeit || "").localeCompare(b.zeit || "")).map(t => treffenZeile(t, t.evId, true)).join("") || '<p class="leer">Keine Treffen geplant.</p>'}
    </div>
  </div>`;
}

function chipListe(text, klasse) {
  return String(text || "").split(",").map(x => x.trim()).filter(Boolean)
    .map(x => `<span class="chip ${klasse}">${esc(x)}</span>`).join("");
}

function profilKarte(u) {
  const meta = [u.stadt, u.alter ? u.alter + " Jahre" : "", u.geschlecht].filter(Boolean).join(" · ");
  return `
  <div class="profil-karte" onclick="A.profil('${u.id}')">
    <div class="profil-kopf">
      <span class="avatar" style="background:${u.farbe}">${esc((u.name || "?")[0])}</span>
      <div class="ez-mitte">
        <div class="ez-name">${esc(u.name)} ${u.istIch ? '<span class="tag">Ich</span>' : ""} ${S.session === u.id ? '<span class="tag aktiv-tag">angemeldet</span>' : ""}</div>
        <div class="ez-sub">${esc([u.firma, meta].filter(Boolean).join(" · ")) || "Profil noch leer – ✎ ausfüllen"}</div>
      </div>
      ${S.session && S.session !== u.id ? `<button class="btn klein" onclick="event.stopPropagation();A.dmOeffnen('${u.id}')" title="Nachricht senden">✉</button>` : ""}
      <button class="btn klein" onclick="event.stopPropagation();A.userFormular('${u.id}')" title="Profil bearbeiten">✎</button>
    </div>
    ${u.interessen || u.faehigkeiten ? `<div class="chip-reihe klein-chips">${chipListe(u.interessen, "interesse")}${chipListe(u.faehigkeiten, "faehigkeit")}</div>` : ""}
    ${u.projekt ? `<div class="profil-zeile">🛠 ${esc(u.projekt)}</div>` : ""}
    ${u.suche || u.biete ? `
    <div class="such-biete">
      ${u.suche ? `<div class="sb-box sucht">🔎 <b>Sucht:</b> ${esc(u.suche)}</div>` : ""}
      ${u.biete ? `<div class="sb-box bietet">🤝 <b>Bietet:</b> ${esc(u.biete)}</div>` : ""}
    </div>` : ""}
  </div>`;
}

A.profil = function (userId) {
  const u = user(userId);
  if (!u) return;
  openModal("Profil: " + u.name, `
    <div class="profil-kopf" style="margin-bottom:14px">
      <span class="avatar" style="background:${u.farbe};width:48px;height:48px;font-size:20px">${esc((u.name || "?")[0])}</span>
      <div class="ez-mitte">
        <div class="ez-name" style="font-size:17px">${esc(u.name)} ${u.verifiziert ? '<span class="tag" title="E-Mail bestätigt">✓ E-Mail</span>' : ""}</div>
        <div class="ez-sub">${esc([u.firma, u.stadt].filter(Boolean).join(" · ")) || "–"}</div>
      </div>
    </div>
    <table class="info-tabelle">
      <tr><td>Wohnort</td><td>${esc(u.stadt) || "–"}</td></tr>
      <tr><td>Firma</td><td>${esc(u.firma) || "–"}</td></tr>
      <tr><td>Alter</td><td>${u.alter || "–"}</td></tr>
      <tr><td>Geschlecht</td><td>${esc(u.geschlecht) || "–"}</td></tr>
      <tr><td>E-Mail</td><td>${esc(u.email) || "–"}</td></tr>
      <tr><td>Interessen</td><td><span class="chip-reihe klein-chips">${chipListe(u.interessen, "interesse") || "–"}</span></td></tr>
      <tr><td>Fähigkeiten</td><td><span class="chip-reihe klein-chips">${chipListe(u.faehigkeiten, "faehigkeit") || "–"}</span></td></tr>
      <tr><td>Projekt</td><td>${esc(u.projekt) || "–"}</td></tr>
      <tr><td>🔎 Sucht</td><td>${esc(u.suche) || "–"}</td></tr>
      <tr><td>🤝 Bietet</td><td>${esc(u.biete) || "–"}</td></tr>
    </table>
    <div class="modal-aktionen">
      ${S.session && S.session !== u.id ? `<button class="btn" onclick="closeModal();A.dmOeffnen('${u.id}')">✉ Nachricht senden</button>` : ""}
      <button class="btn primaer" onclick="closeModal();A.userFormular('${u.id}')">✎ Bearbeiten</button>
    </div>`);
};


A.userFormular = function (userId) {
  const u = userId ? user(userId) : null;
  openModal(u ? "Profil bearbeiten" : "Neues Mitglied", `
    <form onsubmit="return A.userSpeichern(event,'${userId || ""}')">
      <div class="form-reihe">
        <label>Name <input name="name" required value="${esc(u?.name || "")}"></label>
        <label>E-Mail <input type="email" name="email" value="${esc(u?.email || "")}"></label>
      </div>
      <div class="form-reihe">
        <label>Wohnort <input name="stadt" value="${esc(u?.stadt || "")}"></label>
        <label>Firma / Organisation <input name="firma" value="${esc(u?.firma || "")}"></label>
      </div>
      <div class="form-reihe">
        <label>Alter <input type="number" name="alter" min="14" max="99" value="${u?.alter ?? ""}"></label>
        <label>Geschlecht <select name="geschlecht">${["", "weiblich", "männlich", "divers"].map(g => `<option value="${g}" ${(u?.geschlecht || "") === g ? "selected" : ""}>${g || "keine Angabe"}</option>`).join("")}</select></label>
      </div>
      <label>Interessen <input name="interessen" placeholder="kommagetrennt, z. B. GenAI, Robotik, AI Act" value="${esc(u?.interessen || "")}"></label>
      <label>Fähigkeiten <input name="faehigkeiten" placeholder="kommagetrennt, z. B. Python, Prompt Engineering, Vertrieb" value="${esc(u?.faehigkeiten || "")}"></label>
      <label>Aktuelles Projekt <input name="projekt" placeholder="woran arbeitest du gerade?" value="${esc(u?.projekt || "")}"></label>
      <div class="form-reihe">
        <label>🔎 Suche <input name="suche" placeholder="z. B. Mitgründer, GPU-Sponsor, Beta-Tester" value="${esc(u?.suche || "")}"></label>
        <label>🤝 Biete <input name="biete" placeholder="z. B. Mentoring, API-Zugang, Kontakte" value="${esc(u?.biete || "")}"></label>
      </div>
      <label>Farbe <input type="color" name="farbe" value="${u?.farbe || "#38bdf8"}"></label>
      <div class="modal-aktionen">
        ${u && !u.istIch ? `<button type="button" class="btn gefahr" onclick="A.userLoeschen('${u.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.userSpeichern = function (evt, userId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = {
    name: f.get("name"), email: f.get("email"), stadt: f.get("stadt"), farbe: f.get("farbe"),
    firma: f.get("firma"), alter: f.get("alter") ? Number(f.get("alter")) : "", geschlecht: f.get("geschlecht"),
    interessen: f.get("interessen"), faehigkeiten: f.get("faehigkeiten"), projekt: f.get("projekt"),
    suche: f.get("suche"), biete: f.get("biete")
  };
  if (userId) Object.assign(user(userId), daten);
  else S.users.push({ id: uid(), ...daten, istIch: false });
  save(); closeModal(); render();
  return false;
};

A.userLoeschen = function (userId) {
  if (!confirm("Mitglied entfernen?")) return;
  S.users = S.users.filter(u => u.id !== userId);
  if (S.aktiverUser === userId) S.aktiverUser = S.users[0]?.id;
  Object.values(S.teilnehmer).forEach(arr => { const i = arr.indexOf(userId); if (i >= 0) arr.splice(i, 1); });
  save(); closeModal(); render();
};

/* ---------------- Ansicht: Nachrichten (Direktnachrichten) ---------------- */

let dmPartner = null;

function ungeleseneVon(partnerId) {
  return S.nachrichten.filter(n => n.anId === S.session && n.gelesen !== true && (partnerId ? n.vonId === partnerId : true)).length;
}

function renderDmBadge() {
  const el = document.getElementById("dm-badge");
  if (!el) return;
  const n = S.session ? ungeleseneVon(null) : 0;
  el.textContent = n > 0 ? n : "";
  el.className = n > 0 ? "dm-badge" : "";
}

A.dmOeffnen = function (partnerId) {
  if (loginNoetig()) return;
  dmPartner = partnerId;
  // Nachrichten dieses Partners an mich als gelesen markieren
  S.nachrichten.forEach(n => { if (n.vonId === partnerId && n.anId === S.session) n.gelesen = true; });
  save();
  route = { view: "nachrichten", evId: null, tab: "uebersicht" };
  render();
};

function fmtDmZeit(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function vNachrichten() {
  const ich = angemeldeter();
  if (!ich) return `
  <div class="kopf"><h1>Nachrichten</h1><p class="unter">Direktnachrichten zwischen Mitgliedern</p></div>
  <div class="karte"><p class="leer">Bitte zuerst per E-Mail anmelden, um Nachrichten zu lesen und zu senden.</p>
  <button class="btn primaer" onclick="A.loginDialog()">🔐 Mit E-Mail anmelden</button></div>`;

  const partner = S.users.filter(u => u.id !== ich.id);
  if (dmPartner && !user(dmPartner)) dmPartner = null;
  if (!dmPartner) {
    // Partner mit letzter Nachricht zuerst, sonst alphabetisch
    const letzte = {};
    S.nachrichten.forEach(n => {
      const p = n.vonId === ich.id ? n.anId : (n.anId === ich.id ? n.vonId : null);
      if (p) letzte[p] = n.zeit > (letzte[p] || "") ? n.zeit : letzte[p];
    });
    partner.sort((a, b) => (letzte[b.id] || "").localeCompare(letzte[a.id] || "") || a.name.localeCompare(b.name));
    dmPartner = partner[0]?.id || null;
  }
  const thread = dmPartner ? S.nachrichten
    .filter(n => (n.vonId === ich.id && n.anId === dmPartner) || (n.vonId === dmPartner && n.anId === ich.id))
    .sort((a, b) => a.zeit.localeCompare(b.zeit)) : [];

  return `
  <div class="kopf"><h1>Nachrichten</h1><p class="unter">Direktnachrichten zwischen Mitgliedern – angemeldet als ${esc(ich.name)}</p></div>
  <div class="dm-layout">
    <div class="karte dm-liste">
      <h2>Mitglieder</h2>
      ${partner.map(u => {
        const ungelesen = ungeleseneVon(u.id);
        return `
        <div class="user-zeile dm-partner ${dmPartner === u.id ? "aktiv" : ""}" onclick="A.dmOeffnen('${u.id}')">
          <span class="avatar" style="background:${u.farbe}">${esc(u.name[0])}</span>
          <div class="ez-mitte"><div class="ez-name">${esc(u.name)}</div><div class="ez-sub">${esc(u.email || u.stadt || "")}</div></div>
          ${ungelesen ? `<span class="dm-badge">${ungelesen}</span>` : ""}
        </div>`;
      }).join("") || '<p class="leer">Noch keine weiteren Mitglieder – lege welche unter Community an oder lass sie sich per E-Mail registrieren.</p>'}
    </div>
    <div class="karte dm-thread">
      ${dmPartner ? `
      <h2>Unterhaltung mit ${esc(user(dmPartner).name)}</h2>
      <div class="dm-verlauf" id="dm-verlauf">
        ${thread.map(n => `
        <div class="dm-blase ${n.vonId === ich.id ? "mein" : "fremd"}">
          <div>${esc(n.text)}</div>
          <div class="dm-zeit">${fmtDmZeit(n.zeit)}${n.vonId === ich.id ? (n.gelesen ? " · ✓✓ gelesen" : " · ✓ gesendet") : ""}</div>
        </div>`).join("") || '<p class="leer">Noch keine Nachrichten – schreib die erste!</p>'}
      </div>
      <form class="composer" onsubmit="return A.dmSenden(event,'${dmPartner}')">
        <span class="avatar" style="background:${ich.farbe}">${esc(ich.name[0])}</span>
        <input name="text" required placeholder="Nachricht an ${esc(user(dmPartner).name)} …" autocomplete="off">
        <button class="btn primaer">Senden</button>
      </form>` : '<p class="leer">Wähle links ein Mitglied aus.</p>'}
    </div>
  </div>`;
}

A.dmSenden = function (evt, partnerId) {
  evt.preventDefault();
  if (loginNoetig()) return false;
  const text = String(new FormData(evt.target).get("text")).trim();
  if (text) {
    S.nachrichten.push({ id: uid(), vonId: S.session, anId: partnerId, text, zeit: new Date().toISOString(), gelesen: false });
    save(); render();
    const v = document.getElementById("dm-verlauf");
    if (v) v.scrollTop = v.scrollHeight;
  }
  return false;
};

/* ---------------- Ansicht: Event-Detail ---------------- */

const TABS = [
  ["uebersicht", "Übersicht"], ["anmeldung", "Anmeldung & Bezahlung"], ["reise", "Reise"],
  ["kosten", "Kosten"], ["community", "Community"], ["materialien", "Materialien"]
];

function vEventDetail() {
  const e = ev(route.evId);
  if (!e) return '<p class="leer">Veranstaltung nicht gefunden.</p>';
  const st = statusVon(e.id);
  return `
  <div class="detail-kopf" style="--f:${e.farbe}">
    <button class="btn" onclick="A.nav('events')">← Zurück</button>
    <div class="detail-titel">
      <h1>${esc(e.name)}</h1>
      <div class="ez-sub">📅 ${eventZeitraum(e)} · 📍 ${esc(e.ort)}${e.venue ? " · " + esc(e.venue) : ""} · <span class="status ${STATUS_KLASSE[st]}">${st}</span></div>
    </div>
    <button class="btn" onclick="A.eventFormular('${e.id}')">✎ Bearbeiten</button>
  </div>
  <div class="tabs">${TABS.map(([id, label]) => `<button class="tab ${route.tab === id ? 'aktiv' : ''}" onclick="A.tab('${id}')">${label}</button>`).join("")}</div>
  <div class="tab-inhalt">${tabInhalt(e)}</div>`;
}

function tabInhalt(e) {
  switch (route.tab) {
    case "uebersicht": return tUebersicht(e);
    case "anmeldung": return tAnmeldung(e);
    case "reise": return tReise(e);
    case "kosten": return tKostenEvent(e);
    case "community": return tCommunity(e);
    case "materialien": return tMaterialien(e);
  }
  return "";
}

/* ---- Tab: Übersicht ---- */

function tUebersicht(e) {
  const teiln = (S.teilnehmer[e.id] || []).map(user).filter(Boolean);
  return `
  <div class="spalten">
    <div class="karte">
      <h2>Über die Veranstaltung</h2>
      <p>${esc(e.beschreibung) || "Keine Beschreibung."}</p>
      <table class="info-tabelle">
        <tr><td>Kategorie</td><td><span class="tag">${esc(e.kategorie)}</span></td></tr>
        <tr><td>Zeitraum</td><td>${eventZeitraum(e)}</td></tr>
        <tr><td>Ort</td><td>${esc(e.ort)}${e.venue ? " – " + esc(e.venue) : ""}</td></tr>
        <tr><td>Ticketpreis</td><td>${e.preis > 0 ? "ab " + fmtEUR(e.preis) : "kostenlos"}</td></tr>
        <tr><td>Website</td><td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a>` : "–"}</td></tr>
      </table>
      <div class="knopf-reihe">
        <a class="btn" href="${gcalUrl(e)}" target="_blank" rel="noopener">📆 In Google Kalender eintragen</a>
        <button class="btn" onclick="A.icsEvent('${e.id}')">⬇ .ics-Datei</button>
      </div>
      ${e.seed ? '<p class="hinweis">Startdatensatz – Termin und Preis bitte auf der Website prüfen und ggf. anpassen.</p>' : ""}
    </div>
    <div>
      <div class="karte">
        <h2>Schnellübersicht</h2>
        <div class="mini-kpis">
          <div><b>${fmtEUR(kostenSumme(e.id))}</b><span>Kosten bisher</span></div>
          <div><b>${(S.reisen[e.id] || []).length}</b><span>Reiseabschnitte</span></div>
          <div><b>${(S.treffen[e.id] || []).length}</b><span>Treffen</span></div>
          <div><b>${(S.notizen[e.id] || []).length}</b><span>Notizen</span></div>
        </div>
      </div>
      <div class="karte">
        <h2>Teilnehmer (${teiln.length})</h2>
        <div class="chip-reihe">${teiln.map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("") || '<span class="leer">Noch niemand eingetragen.</span>'}</div>
        <button class="btn klein" style="margin-top:10px" onclick="A.tab('community')">Teilnehmer verwalten →</button>
      </div>
    </div>
  </div>`;
}

/* ---- Tab: Anmeldung & Bezahlung ---- */

function tAnmeldung(e) {
  const a = anm(e.id) || {};
  return `
  <div class="spalten">
    <div class="karte">
      <h2>Anmeldung</h2>
      <form onsubmit="return A.anmeldungSpeichern(event,'${e.id}')">
        <div class="form-reihe">
          <label>Status <select name="status">${ANMELDE_STATUS.map(s => `<option ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>Tickettyp <input name="ticketTyp" placeholder="z. B. Early Bird, 2-Tages-Pass" value="${esc(a.ticketTyp || "")}"></label>
        </div>
        <div class="form-reihe">
          <label>Ticketpreis (€) <input type="number" step="0.01" min="0" name="preis" value="${a.preis ?? e.preis ?? ""}"></label>
          <label>Bestell-/Ticketnummer <input name="bestellnr" value="${esc(a.bestellnr || "")}"></label>
        </div>
        <label>Notiz <input name="notiz" placeholder="z. B. Rabattcode, Ansprechpartner" value="${esc(a.notiz || "")}"></label>
        <h2 style="margin-top:18px">Bezahlung</h2>
        <div class="form-reihe">
          <label>Zahlungsart <select name="zahlungsart"><option value="">– wählen –</option>${ZAHLUNGSARTEN.map(z => `<option ${a.zahlungsart === z ? "selected" : ""}>${z}</option>`).join("")}</select></label>
          <label>Bezahlt am <input type="date" name="zahlungsdatum" value="${a.zahlungsdatum || ""}"></label>
        </div>
        <div class="modal-aktionen">
          ${a.status !== "Bezahlt" ? `<button type="button" class="btn" onclick="A.alsBezahlt('${e.id}')">✓ Als bezahlt markieren</button>` : ""}
          <button type="submit" class="btn primaer">Speichern</button>
        </div>
      </form>
    </div>
    <div class="karte">
      <h2>Zahlungsstatus</h2>
      ${zahlungsStatusKarte(e, a)}
      <p class="hinweis">Die App verwaltet Anmeldung und Zahlungsstatus. Die eigentliche Buchung/Zahlung erfolgt beim Veranstalter${e.url ? ` – <a href="${esc(e.url)}" target="_blank" rel="noopener">zur Website</a>` : ""}.</p>
    </div>
  </div>`;
}

function zahlungsStatusKarte(e, a) {
  const preis = Number(a.preis ?? e.preis) || 0;
  const bezahlt = a.status === "Bezahlt" || a.status === "Besucht";
  return `
  <div class="zahlung ${bezahlt ? "ok" : ""}">
    <div class="zahlung-betrag">${fmtEUR(preis)}</div>
    <div class="zahlung-status">${bezahlt ? "✓ bezahlt" + (a.zahlungsdatum ? " am " + fmtDatum(a.zahlungsdatum) : "") : (a.status === "Angemeldet" ? "⏳ Zahlung offen" : "noch nicht angemeldet")}</div>
    ${a.zahlungsart ? `<div class="ez-sub">via ${esc(a.zahlungsart)}${a.bestellnr ? " · Nr. " + esc(a.bestellnr) : ""}</div>` : ""}
  </div>`;
}

A.anmeldungSpeichern = function (evt, evId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  S.anmeldungen[evId] = {
    status: f.get("status"), ticketTyp: f.get("ticketTyp"), preis: Number(f.get("preis")) || 0,
    bestellnr: f.get("bestellnr"), notiz: f.get("notiz"), zahlungsart: f.get("zahlungsart"), zahlungsdatum: f.get("zahlungsdatum")
  };
  save(); render();
  return false;
};

A.alsBezahlt = function (evId) {
  const a = S.anmeldungen[evId] || { preis: ev(evId).preis || 0 };
  a.status = "Bezahlt";
  if (!a.zahlungsdatum) a.zahlungsdatum = heute();
  S.anmeldungen[evId] = a;
  save(); render();
};

/* ---- Tab: Reise ---- */

function tReise(e) {
  const reisen = S.reisen[e.id] || [];
  const hotels = S.uebernachtungen[e.id] || [];
  return `
  <div class="spalten">
    <div class="karte">
      <div class="karte-kopf"><h2>Reiseabschnitte</h2><button class="btn primaer klein" onclick="A.reiseFormular('${e.id}')">+ Abschnitt</button></div>
      ${reisen.map(r => `
        <div class="reise-zeile">
          <span class="reise-icon">${VM_ICON[r.art] || "🧭"}</span>
          <div class="ez-mitte">
            <div class="ez-name">${esc(r.von || "?")} → ${esc(r.nach || "?")} <span class="tag">${esc(r.art)}</span></div>
            <div class="ez-sub">${r.abfahrt ? "Ab " + esc(r.abfahrt.replace("T", " ")) : ""}${r.ankunft ? " · An " + esc(r.ankunft.replace("T", " ")) : ""}${r.notiz ? " · " + esc(r.notiz) : ""}</div>
          </div>
          <b>${fmtEUR(r.kosten)}</b>
          <button class="btn klein" onclick="A.reiseFormular('${e.id}','${r.id}')">✎</button>
        </div>`).join("") || '<p class="leer">Noch keine Reise geplant – Hinfahrt, Rückfahrt und Transfers als Abschnitte anlegen.</p>'}
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2>Übernachtung</h2><button class="btn primaer klein" onclick="A.hotelFormular('${e.id}')">+ Unterkunft</button></div>
      ${hotels.map(h => `
        <div class="reise-zeile">
          <span class="reise-icon">🏨</span>
          <div class="ez-mitte">
            <div class="ez-name">${esc(h.name)}</div>
            <div class="ez-sub">${fmtDatum(h.checkin)} – ${fmtDatum(h.checkout)}${h.notiz ? " · " + esc(h.notiz) : ""}</div>
          </div>
          <b>${fmtEUR(h.kosten)}</b>
          <button class="btn klein" onclick="A.hotelFormular('${e.id}','${h.id}')">✎</button>
        </div>`).join("") || '<p class="leer">Keine Unterkunft erfasst.</p>'}
    </div>
  </div>`;
}

A.reiseFormular = function (evId, reiseId) {
  const r = reiseId ? listOf(S.reisen, evId).find(x => x.id === reiseId) : null;
  openModal(r ? "Reiseabschnitt bearbeiten" : "Reiseabschnitt hinzufügen", `
    <form onsubmit="return A.reiseSpeichern(event,'${evId}','${reiseId || ""}')">
      <label>Verkehrsmittel <select name="art">${VERKEHRSMITTEL.map(v => `<option ${r?.art === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <div class="form-reihe">
        <label>Von <input name="von" required value="${esc(r?.von || "")}"></label>
        <label>Nach <input name="nach" required value="${esc(r?.nach || "")}"></label>
      </div>
      <div class="form-reihe">
        <label>Abfahrt <input type="datetime-local" name="abfahrt" value="${r?.abfahrt || ""}"></label>
        <label>Ankunft <input type="datetime-local" name="ankunft" value="${r?.ankunft || ""}"></label>
      </div>
      <div class="form-reihe">
        <label>Kosten (€) <input type="number" step="0.01" min="0" name="kosten" value="${r?.kosten ?? ""}"></label>
        <label>Notiz <input name="notiz" placeholder="z. B. Zugnummer, Kennzeichen" value="${esc(r?.notiz || "")}"></label>
      </div>
      <div class="modal-aktionen">
        ${r ? `<button type="button" class="btn gefahr" onclick="A.reiseLoeschen('${evId}','${r.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.reiseSpeichern = function (evt, evId, reiseId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { art: f.get("art"), von: f.get("von"), nach: f.get("nach"), abfahrt: f.get("abfahrt"), ankunft: f.get("ankunft"), kosten: Number(f.get("kosten")) || 0, notiz: f.get("notiz") };
  const arr = listOf(S.reisen, evId);
  if (reiseId) Object.assign(arr.find(x => x.id === reiseId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.reiseLoeschen = function (evId, reiseId) {
  S.reisen[evId] = (S.reisen[evId] || []).filter(x => x.id !== reiseId);
  save(); closeModal(); render();
};

A.hotelFormular = function (evId, hotelId) {
  const h = hotelId ? listOf(S.uebernachtungen, evId).find(x => x.id === hotelId) : null;
  const e = ev(evId);
  openModal(h ? "Unterkunft bearbeiten" : "Unterkunft hinzufügen", `
    <form onsubmit="return A.hotelSpeichern(event,'${evId}','${hotelId || ""}')">
      <label>Name / Hotel <input name="name" required value="${esc(h?.name || "")}"></label>
      <div class="form-reihe">
        <label>Check-in <input type="date" name="checkin" value="${h?.checkin || e.start}"></label>
        <label>Check-out <input type="date" name="checkout" value="${h?.checkout || e.end}"></label>
      </div>
      <div class="form-reihe">
        <label>Kosten gesamt (€) <input type="number" step="0.01" min="0" name="kosten" value="${h?.kosten ?? ""}"></label>
        <label>Notiz <input name="notiz" placeholder="z. B. Buchungsnummer" value="${esc(h?.notiz || "")}"></label>
      </div>
      <div class="modal-aktionen">
        ${h ? `<button type="button" class="btn gefahr" onclick="A.hotelLoeschen('${evId}','${h.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.hotelSpeichern = function (evt, evId, hotelId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { name: f.get("name"), checkin: f.get("checkin"), checkout: f.get("checkout"), kosten: Number(f.get("kosten")) || 0, notiz: f.get("notiz") };
  const arr = listOf(S.uebernachtungen, evId);
  if (hotelId) Object.assign(arr.find(x => x.id === hotelId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.hotelLoeschen = function (evId, hotelId) {
  S.uebernachtungen[evId] = (S.uebernachtungen[evId] || []).filter(x => x.id !== hotelId);
  save(); closeModal(); render();
};

/* ---- Tab: Kosten (pro Event) ---- */

function tKostenEvent(e) {
  const zeilen = kostenZeilen(e.id);
  return `
  <div class="karte">
    <div class="karte-kopf">
      <h2>Kosten für ${esc(e.kurz || e.name)} – gesamt ${fmtEUR(kostenSumme(e.id))}</h2>
      <button class="btn primaer klein" onclick="A.kostenFormular('${e.id}')">+ Kostenposten</button>
    </div>
    <table class="tabelle">
      <thead><tr><th>Kategorie</th><th>Beschreibung</th><th>Datum</th><th class="rechts">Netto</th><th class="rechts">USt</th><th class="rechts">Brutto (EUR)</th><th></th></tr></thead>
      <tbody>${zeilen.map(z => `
        <tr>
          <td><span class="tag">${z.kategorie}</span></td><td>${esc(z.beschreibung)}</td><td>${fmtDatum(z.datum)}</td>
          <td class="rechts">${z.netto != null ? fmtEUR(z.netto) : "–"}</td>
          <td class="rechts">${z.ust != null ? fmtEUR(z.ust) + (z.ustSatz != null ? ` <span class="ez-sub">(${z.ustSatz} %)</span>` : "") : "–"}</td>
          <td class="rechts">${fmtEUR(z.betrag)}${z.waehrung && z.waehrung !== "EUR" ? `<div class="ez-sub">${(z.betragOriginal ?? 0).toLocaleString("de-DE")} ${esc(z.waehrung)} @ ${z.kurs}</div>` : ""}</td>
          <td class="rechts">${z.quelle === "manuell" ? `<button class="btn klein" onclick="A.kostenFormular('${e.id}','${z.id}')">✎</button>` : `<span class="ez-sub" title="Automatisch aus ${z.quelle === 'anmeldung' ? 'Anmeldung' : z.quelle === 'reise' ? 'Reiseplanung' : 'Übernachtung'}">auto</span>`}</td>
        </tr>`).join("") || '<tr><td colspan="7" class="leer">Noch keine Kosten. Eintritt, Fahrt und Hotel entstehen automatisch aus den Tabs „Anmeldung" und „Reise"; Verpflegung &amp; Sonstiges hier erfassen.</td></tr>'}
        ${zeilen.length ? `
        <tr class="summen-zeile">
          <td colspan="3"><b>Summe</b></td>
          <td class="rechts"><b>${fmtEUR(zeilen.reduce((s, z) => s + (z.netto ?? z.betrag), 0))}</b></td>
          <td class="rechts"><b>${fmtEUR(zeilen.reduce((s, z) => s + (z.ust ?? 0), 0))}</b></td>
          <td class="rechts"><b>${fmtEUR(zeilen.reduce((s, z) => s + z.betrag, 0))}</b></td>
          <td></td>
        </tr>` : ""}
      </tbody>
    </table>
    <p class="hinweis">Posten mit „auto" stammen aus Anmeldung, Reise oder Übernachtung (Bruttobeträge, dort bearbeiten). Netto/USt und Fremdwährung werden bei manuellen Posten erfasst; in der Netto-Summe zählen Auto-Posten mit ihrem Bruttobetrag.</p>
  </div>`;
}

A.kostenFormular = function (evId, kostenId) {
  const k = kostenId ? listOf(S.kosten, evId).find(x => x.id === kostenId) : null;
  const w = k?.waehrung || "EUR";
  openModal(k ? "Kostenposten bearbeiten" : "Kostenposten hinzufügen", `
    <form onsubmit="return A.kostenSpeichern(event,'${evId}','${kostenId || ""}')">
      <div class="form-reihe">
        <label>Kategorie <select name="kategorie">${KOSTEN_KATEGORIEN.map(x => `<option ${(k?.kategorie || "Verpflegung") === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label>Datum <input type="date" name="datum" value="${k?.datum || heute()}"></label>
      </div>
      <label>Beschreibung <input name="beschreibung" required placeholder="z. B. Mittagessen Tag 1" value="${esc(k?.beschreibung || "")}"></label>
      <div class="form-reihe">
        <label>Betrag (Brutto) <input type="number" step="0.01" min="0" name="betrag" required value="${k?.betragOriginal ?? k?.betrag ?? ""}" oninput="A.kostenVorschau(this.form)"></label>
        <label>Währung <select name="waehrung" onchange="A.kostenWaehrung(this.form)">${Object.keys(WAEHRUNGEN).map(x => `<option ${w === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      </div>
      <div class="form-reihe">
        <label>Kurs (1 Währung = … EUR) <input type="number" step="0.0001" min="0" name="kurs" value="${k?.kurs ?? WAEHRUNGEN[w]}" ${w === "EUR" ? "disabled" : ""} oninput="A.kostenVorschau(this.form)"></label>
        <label>USt-Satz (%) <select name="ustSatz" onchange="A.kostenVorschau(this.form)">${UST_SAETZE.map(s => `<option value="${s}" ${(k?.ustSatz ?? 19) === s ? "selected" : ""}>${s} %</option>`).join("")}</select></label>
      </div>
      <div class="kosten-vorschau" id="kosten-vorschau"></div>
      <p class="hinweis">Fremdwährung wird mit dem Kurs in EUR umgerechnet; der Kurs ist editierbar (Beleg-Kurs eintragen). Bei Auslandsrechnungen ggf. Reverse-Charge beachten – dann USt-Satz 0 % wählen.</p>
      <div class="modal-aktionen">
        ${k ? `<button type="button" class="btn gefahr" onclick="A.kostenLoeschen('${evId}','${k.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
  A.kostenVorschau(document.querySelector(".modal form"));
};

A.kostenVorschau = function (form) {
  if (!form || !form.betrag) return;
  const w = form.waehrung.value;
  if (w === "EUR") { form.kurs.value = 1; form.kurs.disabled = true; } else { form.kurs.disabled = false; }
  const kurs = Number(form.kurs.value) || 0;
  const original = Number(form.betrag.value) || 0;
  const brutto = original * kurs;
  const satz = Number(form.ustSatz.value) || 0;
  const netto = brutto / (1 + satz / 100);
  const el = document.getElementById("kosten-vorschau");
  if (el) el.innerHTML = `${w !== "EUR" ? esc(original.toLocaleString("de-DE")) + " " + esc(w) + " → " : ""}Netto <b>${fmtEUR(netto)}</b> + USt (${satz} %) <b>${fmtEUR(brutto - netto)}</b> = Brutto <b>${fmtEUR(brutto)}</b>`;
};

A.kostenWaehrung = async function (form) {
  const w = form.waehrung.value;
  form.kurs.value = WAEHRUNGEN[w] ?? 1;
  A.kostenVorschau(form);
  if (w === "EUR") return;
  try { // Live-EZB-Kurs als Komfort; bei Offline-Betrieb bleibt der Richtwert stehen
    const r = await fetch(`https://api.frankfurter.app/latest?from=${w}&to=EUR`);
    const d = await r.json();
    if (d?.rates?.EUR && form.waehrung.value === w) {
      form.kurs.value = d.rates.EUR;
      A.kostenVorschau(form);
    }
  } catch (e) { /* offline – Richtwert bleibt */ }
};

A.kostenSpeichern = function (evt, evId, kostenId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const waehrung = f.get("waehrung") || "EUR";
  const kurs = waehrung === "EUR" ? 1 : (Number(f.get("kurs")) || 1);
  const betragOriginal = Number(f.get("betrag")) || 0;
  const ustSatz = Number(f.get("ustSatz")) || 0;
  const brutto = Math.round(betragOriginal * kurs * 100) / 100;
  const netto = Math.round(brutto / (1 + ustSatz / 100) * 100) / 100;
  const daten = {
    kategorie: f.get("kategorie"), beschreibung: f.get("beschreibung"), datum: f.get("datum"),
    betrag: brutto, waehrung, kurs, betragOriginal, ustSatz, netto, ust: Math.round((brutto - netto) * 100) / 100
  };
  const arr = listOf(S.kosten, evId);
  if (kostenId) Object.assign(arr.find(x => x.id === kostenId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.kostenLoeschen = function (evId, kostenId) {
  S.kosten[evId] = (S.kosten[evId] || []).filter(x => x.id !== kostenId);
  save(); closeModal(); render();
};

/* ---- Tab: Community (pro Event) ---- */

function tCommunity(e) {
  const teiln = S.teilnehmer[e.id] || [];
  const treffen = (S.treffen[e.id] || []).slice().sort((a, b) => (a.zeit || "").localeCompare(b.zeit || ""));
  const mitfahrten = S.mitfahrten[e.id] || [];
  const beitraege = (S.beitraege[e.id] || []).slice().sort((a, b) => b.zeit.localeCompare(a.zeit));
  const aktiver = angemeldeter();
  return `
  <div class="spalten">
    <div>
      <div class="karte">
        <h2>Wer ist dabei?</h2>
        <div class="chip-reihe">
          ${S.users.map(u => `
            <label class="chip waehlbar ${teiln.includes(u.id) ? "gewaehlt" : ""}">
              <input type="checkbox" ${teiln.includes(u.id) ? "checked" : ""} onchange="A.teilnahmeToggle('${e.id}','${u.id}')">
              <span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}
            </label>`).join("")}
        </div>
        <p class="hinweis">Neue Mitglieder legst du unter <a href="#" onclick="A.nav('community');return false">Community</a> an.</p>
      </div>
      <div class="karte">
        <div class="karte-kopf"><h2>Treffen</h2><button class="btn primaer klein" onclick="A.treffenFormular('${e.id}')">+ Treffen</button></div>
        ${treffen.map(t => treffenZeile(t, e.id, false)).join("") || '<p class="leer">Noch kein Treffen – z. B. Mittagessen, Warm-up vor der Konferenz oder Nachbetrachtung planen.</p>'}
      </div>
      <div class="karte">
        <div class="karte-kopf"><h2>Mitfahrgelegenheiten</h2><button class="btn primaer klein" onclick="A.mitfahrtFormular('${e.id}')">+ Anbieten</button></div>
        ${mitfahrten.map(m => mitfahrtZeile(m, e.id, false)).join("") || '<p class="leer">Keine Mitfahrgelegenheit angeboten.</p>'}
      </div>
    </div>
    <div class="karte">
      <h2>Austausch</h2>
      ${aktiver ? `
      <form class="composer" onsubmit="return A.beitragSenden(event,'${e.id}')">
        <span class="avatar" style="background:${aktiver.farbe}">${esc(aktiver.name[0])}</span>
        <input name="text" required placeholder="Nachricht als ${esc(aktiver.name)} …" autocomplete="off">
        <button class="btn primaer">Senden</button>
      </form>` : `
      <p class="leer">Zum Mitschreiben bitte anmelden.</p>
      <button class="btn primaer" onclick="A.loginDialog()">🔐 Mit E-Mail anmelden</button>
      <div style="height:12px"></div>`}
      ${beitraege.map(b => `
        <div class="beitrag">
          <span class="avatar" style="background:${user(b.userId)?.farbe || '#666'}">${esc((user(b.userId)?.name || "?")[0])}</span>
          <div>
            <div class="beitrag-meta"><b>${esc(user(b.userId)?.name || "Unbekannt")}</b> · ${esc(b.zeit)}
              ${b.userId === S.session ? `<button class="btn winzig" onclick="A.beitragLoeschen('${e.id}','${b.id}')">löschen</button>` : ""}
            </div>
            <div>${esc(b.text)}</div>
          </div>
        </div>`).join("") || '<p class="leer">Noch keine Beiträge – schreib die erste Nachricht.</p>'}
    </div>
  </div>`;
}

function treffenZeile(t, evId, mitEvent) {
  const teiln = (t.teilnehmer || []).map(user).filter(Boolean);
  const dabei = S.session && (t.teilnehmer || []).includes(S.session);
  return `
  <div class="reise-zeile">
    <span class="reise-icon">🍽️</span>
    <div class="ez-mitte">
      <div class="ez-name">${esc(t.titel || t.typ)} <span class="tag">${esc(t.typ)}</span>${mitEvent ? ` <a href="#" class="tag" onclick="A.openEvent('${evId}','community');return false">${esc(ev(evId)?.kurz || "?")}</a>` : ""}</div>
      <div class="ez-sub">${t.zeit ? esc(t.zeit.replace("T", " ")) + " · " : ""}${esc(t.ort || "Ort offen")}${t.notiz ? " · " + esc(t.notiz) : ""}</div>
      <div class="chip-reihe klein-chips">${teiln.map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("")}</div>
    </div>
    <button class="btn klein ${dabei ? "" : "primaer"}" onclick="A.treffenToggle('${evId}','${t.id}')">${dabei ? "Absagen" : "Teilnehmen"}</button>
    <button class="btn klein" onclick="A.treffenFormular('${evId}','${t.id}')">✎</button>
  </div>`;
}

A.treffenToggle = function (evId, treffenId) {
  if (loginNoetig()) return;
  const t = listOf(S.treffen, evId).find(x => x.id === treffenId);
  if (!t) return;
  t.teilnehmer = t.teilnehmer || [];
  const i = t.teilnehmer.indexOf(S.session);
  if (i >= 0) t.teilnehmer.splice(i, 1); else t.teilnehmer.push(S.session);
  save(); render();
};

function mitfahrtZeile(m, evId, mitEvent) {
  const fahrer = user(m.fahrerId);
  const frei = Math.max(0, (m.plaetze || 0) - (m.mitfahrer || []).length);
  const binDrin = S.session && (m.mitfahrer || []).includes(S.session);
  return `
  <div class="reise-zeile">
    <span class="reise-icon">🚘</span>
    <div class="ez-mitte">
      <div class="ez-name">${esc(m.von || "?")} → ${esc(ev(evId)?.ort || "?")}${mitEvent ? ` <a href="#" class="tag" onclick="A.openEvent('${evId}','community');return false">${esc(ev(evId)?.kurz || "?")}</a>` : ""}</div>
      <div class="ez-sub">Fahrer: ${esc(fahrer?.name || "?")}${m.abfahrt ? " · Ab " + esc(m.abfahrt.replace("T", " ")) : ""} · ${frei} von ${m.plaetze} Plätzen frei${m.notiz ? " · " + esc(m.notiz) : ""}</div>
      <div class="chip-reihe klein-chips">${(m.mitfahrer || []).map(user).filter(Boolean).map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("")}</div>
    </div>
    ${m.fahrerId === S.session ? `<button class="btn klein" onclick="A.mitfahrtFormular('${evId}','${m.id}')">✎</button>` : `<button class="btn klein ${binDrin ? "" : "primaer"}" onclick="A.mitfahrtToggle('${evId}','${m.id}')">${binDrin ? "Aussteigen" : (frei > 0 ? "Mitfahren" : "voll")}</button>`}
  </div>`;
}

A.teilnahmeToggle = function (evId, userId) {
  const arr = listOf(S.teilnehmer, evId);
  const i = arr.indexOf(userId);
  if (i >= 0) arr.splice(i, 1); else arr.push(userId);
  save(); render();
};

A.treffenFormular = function (evId, treffenId) {
  const t = treffenId ? listOf(S.treffen, evId).find(x => x.id === treffenId) : null;
  openModal(t ? "Treffen bearbeiten" : "Treffen planen", `
    <form onsubmit="return A.treffenSpeichern(event,'${evId}','${treffenId || ""}')">
      <div class="form-reihe">
        <label>Art <select name="typ">${TREFFEN_TYPEN.map(x => `<option ${t?.typ === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label>Zeitpunkt <input type="datetime-local" name="zeit" value="${t?.zeit || ""}"></label>
      </div>
      <label>Titel <input name="titel" placeholder="z. B. Mittagessen am AI-Stage-Foodcourt" value="${esc(t?.titel || "")}"></label>
      <label>Ort <input name="ort" placeholder="z. B. Halle 2, Eingang Süd" value="${esc(t?.ort || "")}"></label>
      <label>Notiz <input name="notiz" value="${esc(t?.notiz || "")}"></label>
      <label>Teilnehmer</label>
      <div class="chip-reihe">
        ${(vorbelegt => S.users.map(u => `<label class="chip waehlbar ${vorbelegt.includes(u.id) ? "gewaehlt" : ""}"><input type="checkbox" name="tn" value="${u.id}" ${vorbelegt.includes(u.id) ? "checked" : ""} onchange="this.parentElement.classList.toggle('gewaehlt',this.checked)"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</label>`).join(""))(t?.teilnehmer || (S.session ? [S.session] : []))}
      </div>
      <div class="modal-aktionen">
        ${t ? `<button type="button" class="btn gefahr" onclick="A.treffenLoeschen('${evId}','${t.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.treffenSpeichern = function (evt, evId, treffenId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { typ: f.get("typ"), titel: f.get("titel"), ort: f.get("ort"), zeit: f.get("zeit"), notiz: f.get("notiz"), teilnehmer: f.getAll("tn") };
  const arr = listOf(S.treffen, evId);
  if (treffenId) Object.assign(arr.find(x => x.id === treffenId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.treffenLoeschen = function (evId, treffenId) {
  S.treffen[evId] = (S.treffen[evId] || []).filter(x => x.id !== treffenId);
  save(); closeModal(); render();
};

A.mitfahrtFormular = function (evId, mitfahrtId) {
  const m = mitfahrtId ? listOf(S.mitfahrten, evId).find(x => x.id === mitfahrtId) : null;
  openModal(m ? "Mitfahrgelegenheit bearbeiten" : "Mitfahrgelegenheit anbieten", `
    <form onsubmit="return A.mitfahrtSpeichern(event,'${evId}','${mitfahrtId || ""}')">
      <label>Fahrer <select name="fahrerId">${S.users.map(u => `<option value="${u.id}" ${(m?.fahrerId || S.session || S.aktiverUser) === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
      <div class="form-reihe">
        <label>Abfahrtsort <input name="von" required placeholder="z. B. Stuttgart Hbf P+R" value="${esc(m?.von || "")}"></label>
        <label>Abfahrt <input type="datetime-local" name="abfahrt" value="${m?.abfahrt || ""}"></label>
      </div>
      <div class="form-reihe">
        <label>Freie Plätze <input type="number" min="1" max="8" name="plaetze" value="${m?.plaetze ?? 3}"></label>
        <label>Notiz <input name="notiz" placeholder="z. B. Kostenbeteiligung Sprit" value="${esc(m?.notiz || "")}"></label>
      </div>
      <div class="modal-aktionen">
        ${m ? `<button type="button" class="btn gefahr" onclick="A.mitfahrtLoeschen('${evId}','${m.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.mitfahrtSpeichern = function (evt, evId, mitfahrtId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { fahrerId: f.get("fahrerId"), von: f.get("von"), abfahrt: f.get("abfahrt"), plaetze: Number(f.get("plaetze")) || 1, notiz: f.get("notiz") };
  const arr = listOf(S.mitfahrten, evId);
  if (mitfahrtId) Object.assign(arr.find(x => x.id === mitfahrtId), daten);
  else arr.push({ id: uid(), ...daten, mitfahrer: [] });
  save(); closeModal(); render();
  return false;
};

A.mitfahrtLoeschen = function (evId, mitfahrtId) {
  S.mitfahrten[evId] = (S.mitfahrten[evId] || []).filter(x => x.id !== mitfahrtId);
  save(); closeModal(); render();
};

A.mitfahrtToggle = function (evId, mitfahrtId) {
  if (loginNoetig()) return;
  const m = listOf(S.mitfahrten, evId).find(x => x.id === mitfahrtId);
  if (!m) return;
  m.mitfahrer = m.mitfahrer || [];
  const i = m.mitfahrer.indexOf(S.session);
  if (i >= 0) m.mitfahrer.splice(i, 1);
  else if (m.mitfahrer.length < m.plaetze) m.mitfahrer.push(S.session);
  save(); render();
};

A.beitragSenden = function (evt, evId) {
  evt.preventDefault();
  if (loginNoetig()) return false;
  const text = new FormData(evt.target).get("text").trim();
  if (text) {
    listOf(S.beitraege, evId).push({ id: uid(), userId: S.session, text, zeit: new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) });
    save(); render();
  }
  return false;
};

A.beitragLoeschen = function (evId, beitragId) {
  S.beitraege[evId] = (S.beitraege[evId] || []).filter(b => b.id !== beitragId);
  save(); render();
};

/* ---- Tab: Materialien ---- */

function tMaterialien(e) {
  const notizen = (S.notizen[e.id] || []).slice().sort((a, b) => (b.geaendert || "").localeCompare(a.geaendert || ""));
  return `
  <div class="spalten">
    <div class="karte">
      <div class="karte-kopf"><h2>Notizen</h2><button class="btn primaer klein" onclick="A.notizFormular('${e.id}')">+ Notiz</button></div>
      ${notizen.map(n => `
        <div class="notiz" onclick="A.notizFormular('${e.id}','${n.id}')">
          <div class="ez-name">${esc(n.titel || "Ohne Titel")}</div>
          <div class="notiz-text">${esc(n.text)}</div>
          <div class="ez-sub">zuletzt geändert ${esc(n.geaendert || "–")}</div>
        </div>`).join("") || '<p class="leer">Noch keine Notizen – Erkenntnisse, Kontakte und To-dos zur Veranstaltung festhalten.</p>'}
    </div>
    <div>
      <div class="karte">
        <div class="karte-kopf"><h2>Präsentationen &amp; Dokumente</h2>
          <label class="btn primaer klein datei-btn">+ Hochladen<input type="file" multiple accept=".pdf,.ppt,.pptx,.key,.doc,.docx,.md,.txt" onchange="A.dateiHochladen('${e.id}','praesentation',this)"></label>
        </div>
        ${(() => {
          const mitglieder = (S.sharing[e.id] || []).map(user).filter(Boolean);
          const dabei = S.session && (S.sharing[e.id] || []).includes(S.session);
          return `
          <div class="sharing-leiste">
            <span>🔗 Sharing-Runde: <b>${mitglieder.length}</b> angemeldet</span>
            <span class="chip-reihe klein-chips">${mitglieder.map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("")}</span>
            <button class="btn klein ${dabei ? "" : "primaer"}" onclick="A.sharingToggle('${e.id}')">${dabei ? "Abmelden" : "Zum Sharing anmelden"}</button>
          </div>`;
        })()}
        <div id="dateiliste"><p class="leer">Lade…</p></div>
      </div>
      <div class="karte">
        <div class="karte-kopf"><h2>Bilder</h2>
          <label class="btn primaer klein datei-btn">+ Bilder<input type="file" multiple accept="image/*" onchange="A.dateiHochladen('${e.id}','bild',this)"></label>
        </div>
        <div id="bildergalerie" class="galerie"><p class="leer">Lade…</p></div>
      </div>
    </div>
  </div>`;
}

async function nachladenMaterialien() {
  if (route.view !== "event" || route.tab !== "materialien") return;
  const evId = route.evId;
  try {
    const [dateien, bilder] = await Promise.all([
      dbFilesForEvent(evId, "praesentation"),
      dbFilesForEvent(evId, "bild")
    ]);
    // Sichtbarkeit: eigene Dateien immer; geteilte nur für angemeldete Sharing-Mitglieder;
    // Alt-Dateien ohne Besitzer bleiben für alle sichtbar.
    const ich = S.session;
    const sharingMitglied = ich && (S.sharing[evId] || []).includes(ich);
    const sichtbar = dateien.filter(d => !d.ownerId || d.ownerId === ich || (d.geteilt !== false && sharingMitglied));
    const verborgen = dateien.length - sichtbar.length;
    const dl = document.getElementById("dateiliste");
    if (dl) dl.innerHTML = (sichtbar.map(d => {
      const besitzer = user(d.ownerId);
      const meins = d.ownerId === ich;
      return `
      <div class="reise-zeile">
        <span class="reise-icon">📄</span>
        <div class="ez-mitte"><div class="ez-name">${esc(d.name)} ${d.ownerId ? (d.geteilt !== false ? '<span class="tag">🔗 geteilt</span>' : '<span class="tag">🔒 privat</span>') : ""}</div>
          <div class="ez-sub">${besitzer ? "von " + esc(besitzer.name) + " · " : ""}${esc(d.datum)} · ${(d.blob.size / 1024).toFixed(0)} KB</div></div>
        ${meins ? `<button class="btn klein" onclick="A.dateiTeilen('${d.id}')" title="Freigabe umschalten">${d.geteilt !== false ? "🔒" : "🔗"}</button>` : ""}
        <button class="btn klein" onclick="A.dateiDownload('${d.id}')">⬇</button>
        ${meins || !d.ownerId ? `<button class="btn klein gefahr" onclick="A.dateiLoeschen('${d.id}')">✕</button>` : ""}
      </div>`;
    }).join("") || '<p class="leer">Keine Dateien – Vorträge, Handouts oder eigene Präsentationen hochladen.</p>')
      + (verborgen > 0 ? `<p class="hinweis">🔒 ${verborgen} geteilte Datei${verborgen === 1 ? "" : "en"} verborgen – ${ich ? "melde dich oben zur Sharing-Runde an." : "bitte erst per E-Mail anmelden."}</p>` : "");
    const bg = document.getElementById("bildergalerie");
    if (bg) bg.innerHTML = bilder.map(b => {
      const url = URL.createObjectURL(b.blob);
      return `<div class="galerie-bild"><img src="${url}" alt="${esc(b.name)}" onclick="A.bildAnzeigen('${b.id}')"><button class="galerie-x" onclick="A.dateiLoeschen('${b.id}')">✕</button></div>`;
    }).join("") || '<p class="leer">Keine Bilder – Fotos von Ständen, Slides und Treffen hier sammeln.</p>';
  } catch (err) {
    console.error("Materialien laden fehlgeschlagen:", err);
  }
}

A.dateiHochladen = async function (evId, typ, input) {
  if (typ === "praesentation" && loginNoetig()) { input.value = ""; return; }
  for (const file of input.files) {
    await dbPutFile({
      id: uid(), eventId: evId, typ, name: file.name, mime: file.type, blob: file,
      datum: new Date().toLocaleString("de-DE"),
      ownerId: typ === "praesentation" ? S.session : undefined,
      geteilt: typ === "praesentation" ? true : undefined
    });
  }
  input.value = "";
  nachladenMaterialien();
};

A.sharingToggle = function (evId) {
  if (loginNoetig()) return;
  const arr = listOf(S.sharing, evId);
  const i = arr.indexOf(S.session);
  if (i >= 0) arr.splice(i, 1); else arr.push(S.session);
  save(); render();
};

A.dateiTeilen = async function (id) {
  const d = await dbGetFile(id);
  if (!d || d.ownerId !== S.session) return;
  d.geteilt = d.geteilt === false;
  await dbPutFile(d);
  nachladenMaterialien();
};

A.dateiDownload = async function (id) {
  const d = await dbGetFile(id);
  if (!d) return;
  const url = URL.createObjectURL(d.blob);
  const a = document.createElement("a");
  a.href = url; a.download = d.name; a.click();
  URL.revokeObjectURL(url);
};

A.dateiLoeschen = async function (id) {
  if (!confirm("Datei löschen?")) return;
  await dbDeleteFile(id);
  nachladenMaterialien();
};

A.bildAnzeigen = async function (id) {
  const d = await dbGetFile(id);
  if (!d) return;
  const url = URL.createObjectURL(d.blob);
  openModal(d.name, `<img src="${url}" style="max-width:100%;border-radius:12px" alt="${esc(d.name)}">`);
};

A.notizFormular = function (evId, notizId) {
  const n = notizId ? listOf(S.notizen, evId).find(x => x.id === notizId) : null;
  openModal(n ? "Notiz bearbeiten" : "Neue Notiz", `
    <form onsubmit="return A.notizSpeichern(event,'${evId}','${notizId || ""}')">
      <label>Titel <input name="titel" placeholder="z. B. Keynote-Takeaways" value="${esc(n?.titel || "")}"></label>
      <label>Text <textarea name="text" rows="8" required>${esc(n?.text || "")}</textarea></label>
      <div class="modal-aktionen">
        ${n ? `<button type="button" class="btn gefahr" onclick="A.notizLoeschen('${evId}','${n.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.notizSpeichern = function (evt, evId, notizId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { titel: f.get("titel"), text: f.get("text"), geaendert: new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) };
  const arr = listOf(S.notizen, evId);
  if (notizId) Object.assign(arr.find(x => x.id === notizId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.notizLoeschen = function (evId, notizId) {
  S.notizen[evId] = (S.notizen[evId] || []).filter(x => x.id !== notizId);
  save(); closeModal(); render();
};

/* ---------------- Modal ---------------- */

function openModal(titel, html) {
  const wrap = document.getElementById("modal-wrap");
  wrap.innerHTML = `
    <div class="modal-hintergrund" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-kopf"><h2>${esc(titel)}</h2><button class="btn" onclick="closeModal()">✕</button></div>
        <div class="modal-inhalt">${html}</div>
      </div>
    </div>`;
  wrap.style.display = "block";
  const feld = wrap.querySelector("input,textarea,select");
  if (feld) feld.focus();
}
function closeModal() {
  const wrap = document.getElementById("modal-wrap");
  wrap.style.display = "none";
  wrap.innerHTML = "";
}
window.closeModal = closeModal;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------------- Start ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".navlink").forEach(el => el.addEventListener("click", () => A.nav(el.dataset.view)));
  A.theme(localStorage.getItem("aimg2026_theme") || "neon");
  render();
  if (typeof CLOUD !== "undefined") CLOUD.init().then(ok => { if (ok) render(); }).catch(e => console.warn("Cloud-Init:", e.message));
});
