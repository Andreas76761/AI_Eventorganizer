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
    merker: {},        // evId -> true (vorgemerkt)
    sessions: {},      // evId -> [{id, titel, tag, start, ende, buehne, thema, speakerIds:[], beschreibung, favorit}]
    speaker: {},       // evId -> [{id, name, firma, rolle, thema, bio, linkedin, rating}]
    trends: {},        // evId -> [{id, titel, relevanz(1-5), beschreibung}]
    nuggets: {},       // evId -> [{id, text, quelle}]
    aufgaben: {},      // evId -> [{id, text, wer(userId), erledigt}]
    posts: {}          // evId -> {vor, waehrend, nach} – manuell angepasste LinkedIn-Texte
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

// Verkehrsmittel → Lucide-Icon (ersetzt die früheren Emojis in der Oberfläche)
const VM_IKON_NAME = { "Pkw": "auto", "Bahn": "bahn", "Flug": "flug", "ÖPNV": "bus", "Fernbus": "bus", "Mitfahrgelegenheit": "auto", "Fahrrad": "rad", "Sonstiges": "kompass" };
function vmIkon(art) { return ikon(VM_IKON_NAME[art] || "kompass", 20); }

/* ---------------- Kostenberechnung ---------------- */

function kostenZeilen(evId) {
  // Liefert alle Kostenposten eines Events als einheitliche Zeilen.
  const zeilen = [];
  const a = anm(evId);
  if (a && a.preis > 0 && a.status !== "Abgesagt") {
    zeilen.push({ kategorie: "Eintritt", beschreibung: "Ticket" + (a.ticketTyp ? " (" + a.ticketTyp + ")" : ""), betrag: Number(a.preis), datum: a.zahlungsdatum || "", quelle: "anmeldung" });
  }
  (S.reisen[evId] || []).forEach(r => {
    if (r.kosten > 0) zeilen.push({ kategorie: "Fahrtkosten", beschreibung: r.art + ": " + (r.von || "?") + " → " + (r.nach || "?"), betrag: Number(r.kosten), datum: r.abfahrt ? r.abfahrt.slice(0, 10) : "", quelle: "reise" });
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
      <button class="btn klein" onclick="A.kontoDialog()" title="Konto & Daten">${ikon("einstellungen",14)}</button>
      <button class="btn klein" onclick="A.logout()" title="Abmelden">${ikon("abmelden",14)}</button>
    </div>` : `
    <button class="btn primaer login-btn" onclick="A.loginDialog()">${ikon("schloss",14)} Mit E-Mail anmelden</button>
    <button class="btn klein login-btn" style="margin-top:6px" onclick="A.kontoDialog()">${ikon("einstellungen",14)} Konto &amp; Daten</button>`);
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
      <button class="btn" onclick="A.datenExport()">${ikon("download",15)} Alle Daten als JSON exportieren (Art. 20 DSGVO)</button>
      <label class="btn datei-btn" style="text-align:center">${ikon("upload",15)} Daten aus JSON-Export importieren<input type="file" accept=".json,application/json" onchange="A.datenImport(this)"></label>
      ${cloud && u ? `<button class="btn" onclick="A.mfaEinrichtenDialog()">${ikon("schloss",15)} Zwei-Faktor-Authentifizierung (MFA) einrichten</button>` : ""}
      ${u ? `<button class="btn gefahr" onclick="A.kontoLoeschen()">${ikon("loeschen",15)} Mein Konto und meine Inhalte löschen (Art. 17 DSGVO)</button>` : ""}
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
  Object.keys(S.sessions).forEach(k => S.sessions[k].forEach(x => { const i = (x.besucher || []).indexOf(uid_); if (i >= 0) x.besucher.splice(i, 1); }));
  Object.keys(S.aufgaben).forEach(k => S.aufgaben[k].forEach(x => { if (x.wer === uid_) x.wer = ""; }));
  Object.keys(S.treffen).forEach(k => S.treffen[k].forEach(t => (t.vorschlaege || []).forEach(v => { const i = (v.stimmen || []).indexOf(uid_); if (i >= 0) v.stimmen.splice(i, 1); })));
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
    case "posts": main.innerHTML = vPosts(); nachladenPostBilder(); break;
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
      <span>${ikon("auswahl",15)} In der Auswahlliste warten <b>${offen} Veranstaltungen</b> auf deine Teilnahme-Entscheidung.</span>
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
      <div class="ez-name">${S.merker[e.id] ? ikon("merkliste",13) + " " : ""}${esc(e.name)}</div>
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
      ${e.preise && e.preise.length ? `<tr><td>Ticketpreise</td><td>${preisStaffel(e)}</td></tr>` : ""}
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
        <button class="btn klein ${S.merker[evId] ? "gewaehlt-ja ja-btn" : ""}" onclick="A.merkerToggle('${evId}')">${ikon("merkliste",13)} ${S.merker[evId] ? "vorgemerkt" : "vormerken"}</button>
      </td></tr>
    </table>
    <div class="modal-aktionen">
      <a class="btn" href="${gcalUrl(e)}" target="_blank" rel="noopener">${ikon("kalender-plus",14)} Google Kalender</a>
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
  const vielleicht = AUSWAHL_KANDIDATEN.filter(k => kandidatTeilnahme(k.id) === "vielleicht");
  const jaSumme = ja.reduce((s, k) => s + (Number(kandidatKosten(k)) || 0), 0);
  return `
  <div class="kopf"><h1>Auswahlliste AI-Veranstaltungen</h1>
    <p class="unter">2025 &amp; 2026 – aus Web-Recherche und deinem Google-Kalender. Teilnahme wählen, Kosten anpassen – „Ja" übernimmt die Veranstaltung in die App.</p></div>
  <div class="kpi-reihe">
    <div class="kpi"><div class="kpi-wert">${ja.length}</div><div class="kpi-label">Teilnahme: Ja</div></div>
    <div class="kpi"><div class="kpi-wert" style="color:#fbbf24">${vielleicht.length}</div><div class="kpi-label">Vielleicht</div></div>
    <div class="kpi"><div class="kpi-wert">${AUSWAHL_KANDIDATEN.filter(k => kandidatTeilnahme(k.id) === "nein").length}</div><div class="kpi-label">Teilnahme: Nein</div></div>
    <div class="kpi akzent"><div class="kpi-wert">${fmtEUR(jaSumme)}</div><div class="kpi-label">Ticketkosten der Zusagen</div></div>
  </div>
  <div class="werkzeuge">
    <div class="filter-gruppe">
      ${["alle", "2025", "2026"].map(j => `<button class="filter ${auswahlFilter.jahr === j ? 'aktiv' : ''}" onclick="A.setAuswahlFilter('jahr','${j}')">${j === "alle" ? "Alle Jahre" : j}</button>`).join("")}
      <span style="width:14px"></span>
      ${[["alle", "Alle"], ["offen", "Offen"], ["ja", "Ja"], ["vielleicht", "Vielleicht"], ["nein", "Nein"]].map(([w, l]) => `<button class="filter ${auswahlFilter.status === w ? 'aktiv' : ''}" onclick="A.setAuswahlFilter('status','${w}')">${l}</button>`).join("")}
    </div>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>Kandidaten (${AUSWAHL_KANDIDATEN.length})</h2><button class="btn klein" onclick="A.icsZusagen()">${ikon("download",14)} .ics aller Zusagen (Google-Kalender-Import)</button></div>
    <table class="tabelle auswahl-tabelle">
      <thead><tr><th>Termin</th><th>Veranstaltung</th><th>Ort</th><th>Quelle</th><th class="rechts">Kosten (€)</th><th>Teilnahme</th></tr></thead>
      <tbody>
      ${liste.map(k => {
        const t = kandidatTeilnahme(k.id);
        const vorbei = k.end < heute();
        const verknuepft = S.auswahl[k.id]?.eventId && ev(S.auswahl[k.id].eventId);
        const zielEv = verknuepft ? S.auswahl[k.id].eventId : (k.eventId && ev(k.eventId) ? k.eventId : null);
        const dabei = zielEv ? (S.teilnehmer[zielEv] || []).filter(id => id !== S.session).map(user).filter(Boolean) : [];
        return `
        <tr class="${t === 'nein' ? 'gedimmt' : ''}">
          <td class="nowrap">${eventZeitraum(k)}${vorbei ? ' <span class="tag">vorbei</span>' : ""}</td>
          <td><b>${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.name)}</a>` : esc(k.name)}</b>
            ${k.venue ? `<div class="ez-sub">${esc(k.venue)}</div>` : ""}
            ${verknuepft ? `<div class="ez-sub">→ <a href="#" onclick="A.openEvent('${S.auswahl[k.id].eventId}');return false">in der App geöffnet</a></div>` : ""}</td>
          <td>${esc(k.ort)}</td>
          <td><span class="tag ${k.quelle === 'Google-Kalender' ? 'aktiv-tag' : ''}">${k.quelle === 'Google-Kalender' ? `${ikon("kalender",13)} Kalender` : `${ikon("suche",13)} Recherche`}</span></td>
          <td class="rechts"><input type="number" class="kosten-feld" min="0" step="1" value="${kandidatKosten(k)}" onchange="A.auswahlKosten('${k.id}',this.value)"></td>
          <td class="nowrap">
            <button class="btn klein ja-btn ${t === 'ja' ? 'gewaehlt-ja' : ''}" onclick="A.teilnahme('${k.id}','ja')">✓ Ja</button>
            <button class="btn klein vlt-btn ${t === 'vielleicht' ? 'gewaehlt-vlt' : ''}" onclick="A.teilnahme('${k.id}','vielleicht')" title="Noch unentschieden – vormerken">? Vlt</button>
            <button class="btn klein nein-btn ${t === 'nein' ? 'gewaehlt-nein' : ''}" onclick="A.teilnahme('${k.id}','nein')">✕ Nein</button>
            <a class="btn klein" href="${gcalUrl(k)}" target="_blank" rel="noopener" title="In Google Kalender eintragen">${ikon("kalender-plus",14)}</a>
            ${dabei.length ? `<span class="tag aktiv-tag" title="Aus der Community dabei: ${esc(dabei.map(u => u.name).join(", "))}">${ikon("community",13)} ${dabei.length}</span>` : ""}
          </td>
        </tr>`;
      }).join("") || '<tr><td colspan="6" class="leer">Keine Kandidaten für diesen Filter.</td></tr>'}
      </tbody>
    </table>
    <p class="hinweis">Quelle „Kalender": aus deinem Google-Kalender (inkl. Abos „KI-Café" und „AI xpress"). Quelle „Recherche": Web-Recherche Juli 2026 – Termine und Preise vor Buchung auf der verlinkten Website prüfen. Bei „Ja" wird die Veranstaltung mit Status „Interessiert" und dem Kostenwert als Ticketpreis in die App übernommen; „? Vlt" merkt sie als unentschieden vor (keine Übernahme); bei „Nein" wird eine automatisch übernommene Veranstaltung wieder entfernt (bereits erfasste Daten bleiben erhalten, dann Status „Abgesagt"). Das Personen-Symbol zeigt, wie viele andere Community-Mitglieder bei der verknüpften Veranstaltung als Teilnehmer eingetragen sind.</p>
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
    } else if (e && wert === "nein") { // nur echtes Nein sagt ab; „vielleicht" lässt den Status unangetastet
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

const EVENT_BEREICHE = [
  ["uebersicht", "Übersicht", "uebersicht"],
  ["karte", "Deutschlandkarte", "karte"],
  ["zeitleiste", "Zeitleiste", "zeitleiste"],
  ["merkliste", "Merkliste", "merkliste"],
  ["archiv", "Archiv", "archiv"],
  ["statistik", "Statistik", "statistik"]
];
let eventsSub = "uebersicht";
let eventsBurgerOffen = false;

A.eventsBurger = function () {
  eventsBurgerOffen = !eventsBurgerOffen;
  const m = document.getElementById("events-burger-menue");
  if (m) m.style.display = eventsBurgerOffen ? "block" : "none";
};

A.eventsBereich = function (sub) {
  eventsBurgerOffen = false;
  eventsSub = sub;
  render();
};

function gefilterteEvents() {
  let liste = [...S.events].sort((a, b) => a.start.localeCompare(b.start));
  if (eventFilter === "kommend") liste = liste.filter(e => e.end >= heute());
  else if (eventFilter !== "alle") liste = liste.filter(e => statusVon(e.id) === eventFilter);
  const q = eventSuche.trim().toLowerCase();
  if (q) liste = liste.filter(e => passtZurSuche(e, q));
  return liste;
}

function eventWerkzeuge() {
  const filter = ["alle", "kommend", "Angemeldet", "Bezahlt", "Besucht"];
  return `
  <div class="werkzeuge">
    <input id="suchfeld" class="suchfeld" placeholder="Messe suchen – Name, Ort, Thema …" value="${esc(eventSuche)}" oninput="A.suche(this.value)">
    <div class="filter-gruppe">${filter.map(f => `<button class="filter ${eventFilter === f ? 'aktiv' : ''}" onclick="A.setEventFilter('${f}')">${f === "alle" ? "Alle" : f === "kommend" ? "Anstehend" : f}</button>`).join("")}</div>
    <button class="btn primaer" onclick="A.eventFormular()">+ Neue Veranstaltung</button>
    <label class="btn datei-btn" title="Event-Paket eines Kollegen zusammenführen">${ikon("paket",14)} Paket-Import<input type="file" accept=".json,application/json" onchange="A.paketImport(this)"></label>
  </div>`;
}

function vEvents() {
  const bereichName = Object.fromEntries(EVENT_BEREICHE)[eventsSub] || "Bereich";
  let inhalt = "";
  switch (eventsSub) {
    case "karte": inhalt = eBereichKarte(); break;
    case "zeitleiste": inhalt = eBereichZeitleiste(); break;
    case "merkliste": inhalt = eBereichMerkliste(); break;
    case "archiv": inhalt = eBereichArchiv(); break;
    case "statistik": inhalt = eBereichStatistik(); break;
    default: inhalt = eBereichUebersicht();
  }
  return `
  <div class="kopf community-kopf">
    <div><h1>Veranstaltungen</h1><p class="unter">AI-Messen &amp; Konferenzen – Bereich über das Menü oben rechts wählen</p></div>
    <div class="burger-wrap">
      <button class="btn burger-btn" onclick="A.eventsBurger()">${ikon("menue", 16)} ${bereichName}</button>
      <div class="burger-menue" id="events-burger-menue" style="display:${eventsBurgerOffen ? "block" : "none"}">
        ${EVENT_BEREICHE.map(([id, label, ic]) => `<div class="burger-punkt ${eventsSub === id ? "aktiv" : ""}" onclick="A.eventsBereich('${id}')">${ikon(ic, 16)} ${label}</div>`).join("")}
      </div>
    </div>
  </div>
  ${inhalt}`;
}

/* ---- Bereich: Deutschlandkarte (Muster: 1E9-Festival-App Standorte-Tab) ---- */

let karteKategorie = "alle";
let karteStadt = null;

A.karteKategorie = function (kat) { karteKategorie = kat; karteStadt = null; render(); };
A.karteStadtWahl = function (stadt) { karteStadt = (karteStadt === stadt) ? null : stadt; render(); };

function eBereichKarte() {
  let liste = gefilterteEvents();
  if (karteKategorie !== "alle") liste = liste.filter(e => e.kategorie === karteKategorie);
  const proStadt = {};
  liste.forEach(e => { (proStadt[e.ort] = proStadt[e.ort] || []).push(e); });
  const punkte = [], ohneKoords = [];
  Object.entries(proStadt).forEach(([stadt, evs]) => {
    const k = STADT_KOORDS[stadt];
    if (!k) { ohneKoords.push(...evs); return; }
    const [x, y] = kartePx(k[0], k[1]);
    punkte.push({ stadt, evs, x, y });
  });
  punkte.sort((a, b) => b.evs.length - a.evs.length);
  if (karteStadt && !proStadt[karteStadt]) karteStadt = null; // Auswahl weggefiltert
  const kategorien = ["alle", ...new Set(S.events.map(e => e.kategorie).filter(Boolean))];
  const detail = karteStadt ? proStadt[karteStadt] : null;
  return `
  ${eventWerkzeuge()}
  <div class="werkzeuge" style="margin-top:-8px">
    <div class="filter-gruppe">
      ${kategorien.map(k => `<button class="filter ${karteKategorie === k ? 'aktiv' : ''}" onclick="A.karteKategorie('${k}')">${k === "alle" ? "Alle Kategorien" : esc(k)}</button>`).join("")}
    </div>
  </div>
  <div class="karten-layout">
    <div class="karte">
      <svg viewBox="0 0 ${KARTE_W} ${KARTE_H}" class="de-karte" role="img" aria-label="Deutschlandkarte mit Veranstaltungsorten">
        ${DE_BUNDESLAENDER.map(b => `<path d="${b.d}" class="bl-pfad"><title>${esc(b.name)}</title></path>`).join("")}
        ${punkte.map(p => `
        <g class="stadt-punkt ${karteStadt === p.stadt ? "gewaehlt" : ""}" onclick="A.karteStadtWahl('${esc(p.stadt)}')">
          <circle cx="${p.x}" cy="${p.y}" r="${(8 + Math.min(5, p.evs.length * 1.5)) * (karteStadt === p.stadt ? 1.25 : 1)}" fill="${karteStadt === p.stadt ? "#fbbf24" : p.evs[0].farbe}" class="punkt-kreis"/>
          ${p.evs.length > 1 ? `<text x="${p.x}" y="${p.y + 3.8}" class="punkt-zahl">${p.evs.length}</text>` : ""}
          <text x="${p.x}" y="${p.y - 14}" class="stadt-label">${esc(p.stadt.split(" (")[0])}</text>
          <title>${esc(p.stadt)}: ${p.evs.map(e => esc(e.kurz || e.name)).join(", ")}</title>
        </g>`).join("")}
      </svg>
    </div>
    <div class="karte">
      <h2>Veranstaltungsorte (DE)</h2>
      <p class="hinweis" style="margin:0 0 10px">Kreisgröße = Anzahl Veranstaltungen. Auf Marker oder Stadt klicken für Details.</p>
      <div class="stadt-chips">
        ${punkte.map(p => `<button class="stadt-chip ${karteStadt === p.stadt ? "aktiv" : ""}" onclick="A.karteStadtWahl('${esc(p.stadt)}')">${esc(p.stadt)} <b>${p.evs.length}</b></button>`).join("") || '<span class="leer">Keine Treffer für Suche/Filter.</span>'}
      </div>
      ${detail ? `
      <div class="stadt-detail">
        <h2>${ikon("pin",16)} ${esc(karteStadt)} · ${detail.length} Veranstaltung${detail.length === 1 ? "" : "en"}</h2>
        ${detail.sort((a, b) => a.start.localeCompare(b.start)).map(e => `
        <div class="event-zeile" onclick="A.openEvent('${e.id}')">
          <span class="punkt" style="background:${e.farbe}"></span>
          <div class="ez-mitte">
            <div class="ez-name">${esc(e.name)}</div>
            <div class="ez-sub">${eventZeitraum(e)}${e.venue ? " · " + esc(e.venue) : ""} · <span class="tag">${esc(e.kategorie)}</span></div>
          </div>
          <span class="status ${STATUS_KLASSE[statusVon(e.id)]}">${statusVon(e.id)}</span>
          <button class="btn klein" onclick="event.stopPropagation();A.eventDetails('${e.id}')">Details</button>
        </div>`).join("")}
      </div>` : '<div class="stadt-detail leer-detail"><em>Stadt auswählen …</em></div>'}
      ${ohneKoords.length ? `<p class="hinweis">Ohne Kartenposition: ${[...new Set(ohneKoords.map(e => e.ort))].map(esc).join(", ")} – Stadt in STADT_KOORDS (js/karte.js) ergänzen.</p>` : ""}
    </div>
  </div>`;
}

/* ---- Bereiche: Zeitleiste, Merkliste, Archiv ---- */

function eBereichZeitleiste() {
  const liste = gefilterteEvents();
  const monate = {};
  liste.forEach(e => { const m = e.start.slice(0, 7); (monate[m] = monate[m] || []).push(e); });
  return `
  ${eventWerkzeuge()}
  ${Object.keys(monate).sort().map(m => `
  <div class="karte">
    <h2>${new Date(m + "-01T12:00:00Z").toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h2>
    ${monate[m].map(e => zeileEvent(e)).join("")}
  </div>`).join("") || '<div class="karte"><p class="leer">Keine Treffer für Suche/Filter.</p></div>'}`;
}

function eBereichMerkliste() {
  const liste = [...S.events].filter(e => S.merker[e.id] || S.bewertungen[e.id]).sort((a, b) => a.start.localeCompare(b.start));
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Gemerkte &amp; bewertete Veranstaltungen (${liste.length})</h2></div>
    ${liste.map(e => zeileEvent(e)).join("") || '<p class="leer">Noch nichts gemerkt – im Details-Popup einer Veranstaltung „vormerken" oder Sterne vergeben.</p>'}
  </div>`;
}

function eBereichArchiv() {
  const liste = [...S.events].filter(e => e.end < heute()).sort((a, b) => b.start.localeCompare(a.start));
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Vergangene Veranstaltungen (${liste.length})</h2></div>
    ${liste.map(e => zeileEvent(e)).join("") || '<p class="leer">Noch keine vergangenen Veranstaltungen.</p>'}
    <p class="hinweis">Tipp: Nachbetrachtung im Details-Popup bewerten (★) und Erkenntnisse als Notizen im Materialien-Tab festhalten.</p>
  </div>`;
}

/* ---- Bereich: Statistik ---- */

function zaehle(werte) {
  const z = {};
  werte.filter(Boolean).forEach(w => z[w] = (z[w] || 0) + 1);
  return Object.entries(z).sort((a, b) => b[1] - a[1]);
}

function balkenListe(paare, einheit) {
  const max = Math.max(...paare.map(p => p[1]), 1);
  return paare.slice(0, 10).map(([label, n]) => `
    <div class="balken-zeile">
      <span class="balken-label" title="${esc(label)}">${esc(String(label).slice(0, 18))}</span>
      <div class="balken-spur"><div class="balken" style="width:${Math.round(n / max * 100)}%"></div></div>
      <span class="balken-wert">${n}${einheit || ""}</span>
    </div>`).join("") || '<p class="leer">Noch keine Daten.</p>';
}

function eBereichStatistik() {
  const alleSessions = Object.values(S.sessions).flat();
  const alleSpeaker = Object.values(S.speaker).flat();
  return `
  <div class="kpi-reihe">
    <div class="kpi"><div class="kpi-wert">${S.events.length}</div><div class="kpi-label">Veranstaltungen</div></div>
    <div class="kpi"><div class="kpi-wert">${alleSessions.length}</div><div class="kpi-label">Sessions</div></div>
    <div class="kpi"><div class="kpi-wert">${alleSpeaker.length}</div><div class="kpi-label">Speaker</div></div>
    <div class="kpi akzent"><div class="kpi-wert">${new Set(S.events.map(e => e.ort)).size}</div><div class="kpi-label">Städte</div></div>
  </div>
  <div class="spalten">
    <div class="karte"><h2>Veranstaltungen nach Kategorie</h2>${balkenListe(zaehle(S.events.map(e => e.kategorie)))}</div>
    <div class="karte"><h2>Veranstaltungen nach Stadt</h2>${balkenListe(zaehle(S.events.map(e => e.ort)))}</div>
  </div>
  <div class="spalten">
    <div class="karte"><h2>Anmeldestatus</h2>${balkenListe(zaehle(S.events.map(e => statusVon(e.id))))}</div>
    <div class="karte"><h2>Session-Themen (alle Veranstaltungen)</h2>${balkenListe(zaehle(alleSessions.map(s => s.thema)))}</div>
  </div>
  <div class="spalten">
    <div class="karte"><h2>Top-Firmen nach Speakern</h2>${balkenListe(zaehle(alleSpeaker.map(s => s.firma)), " Speaker")}</div>
    <div class="karte"><h2>Speaker-Themen</h2>${balkenListe(zaehle(alleSpeaker.map(s => s.thema)))}</div>
  </div>`;
}

/* ---- Bereich: Übersicht (Kartenraster) ---- */

function eBereichUebersicht() {
  const liste = gefilterteEvents();
  const q = eventSuche.trim().toLowerCase();
  const kandidatenTreffer = q ? AUSWAHL_KANDIDATEN.filter(k => passtZurSuche(k, q) && !(S.auswahl[k.id]?.eventId && ev(S.auswahl[k.id].eventId))) : [];
  return `
  ${eventWerkzeuge()}
  ${kandidatenTreffer.length ? `
  <div class="karte banner">
    <span>${ikon("suche",14)} <b>${kandidatenTreffer.length} Treffer</b> in der Auswahlliste: ${kandidatenTreffer.slice(0, 3).map(k => esc(k.name)).join(", ")}${kandidatenTreffer.length > 3 ? "…" : ""}</span>
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
            <span>${S.merker[e.id] ? ikon("merkliste",13) + " " : ""}${S.bewertungen[e.id] ? '<span class="sterne-mini">' + "★".repeat(S.bewertungen[e.id]) + "</span> " : ""}${teiln > 0 ? ikon("community",13) + " " + teiln : ""}</span>
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
    <div class="karte-kopf"><h2>Verteilung nach Kategorie</h2><button class="btn" onclick="A.csvExport()">${ikon("download",14)} CSV-Export</button></div>
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

const COMMUNITY_BEREICHE = [
  ["profile", "Profile & Mitglieder", "profil"],
  ["matching", "Matching (Suche ↔ Biete)", "matching"],
  ["meine", "Meine nächsten Events", "kalender-check"],
  ["mitfahrten", "Mitfahrgelegenheiten", "auto"],
  ["treffen", "Treffen", "essen"],
  ["nachrichten", "Nachrichten", "nachrichten"]
];
let communitySub = "profile";
let burgerOffen = false;

A.burger = function () {
  burgerOffen = !burgerOffen;
  const m = document.getElementById("burger-menue");
  if (m) m.style.display = burgerOffen ? "block" : "none";
};

A.communityBereich = function (sub) {
  burgerOffen = false;
  if (sub === "nachrichten") { A.nav("nachrichten"); return; }
  communitySub = sub;
  render();
};

function vCommunity() {
  const bereichName = Object.fromEntries(COMMUNITY_BEREICHE)[communitySub] || "Bereich";
  let inhalt = "";
  switch (communitySub) {
    case "matching": inhalt = cBereichMatching(); break;
    case "meine": inhalt = cBereichMeineEvents(); break;
    case "mitfahrten": inhalt = cBereichMitfahrten(); break;
    case "treffen": inhalt = cBereichTreffen(); break;
    default: inhalt = cBereichProfile();
  }
  return `
  <div class="kopf community-kopf">
    <div><h1>Community</h1><p class="unter">Profile, Matching, Mitfahrten und Treffen – Bereich über das Menü oben rechts wählen</p></div>
    <div class="burger-wrap">
      <button class="btn burger-btn" onclick="A.burger()">${ikon("menue", 16)} ${bereichName}</button>
      <div class="burger-menue" id="burger-menue" style="display:${burgerOffen ? "block" : "none"}">
        ${COMMUNITY_BEREICHE.map(([id, label, ic]) => `<div class="burger-punkt ${communitySub === id ? "aktiv" : ""}" onclick="A.communityBereich('${id}')">${ikon(ic, 16)} ${label}</div>`).join("")}
      </div>
    </div>
  </div>
  ${inhalt}`;
}

/* ---- Community-Bereich: Profile ---- */

function cBereichProfile() {
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Mitglieder &amp; Kurzprofile (${S.users.length})</h2><button class="btn primaer klein" onclick="A.userFormular()">+ Mitglied</button></div>
    <div class="profil-gitter">
      ${S.users.map(u => profilKarte(u)).join("")}
    </div>
    <p class="hinweis">Profil über den Stift-Knopf pflegen: Interessen, Fähigkeiten, aktuelles Projekt, LinkedIn sowie „Suche/Biete" für gezieltes Netzwerken auf der Messe. Beiträge, Treffen, Mitfahrten und Nachrichten laufen über den per E-Mail angemeldeten Nutzer.</p>
  </div>`;
}

/* ---- Community-Bereich: Matching (Suche ↔ Biete) ---- */

function suchTokens(text) {
  return [...new Set(String(text || "").toLowerCase().split(/[^a-zäöüß0-9\-]+/).filter(t => t.length >= 4))];
}

function suchBieteMatches() {
  const res = [];
  S.users.forEach(a => {
    if (!a.suche) return;
    S.users.forEach(b => {
      if (a.id === b.id || !b.biete) return;
      const ta = suchTokens(a.suche), tb = suchTokens(b.biete);
      const treffer = ta.filter(x => tb.some(y => x.startsWith(y.slice(0, 5)) || y.startsWith(x.slice(0, 5))));
      if (treffer.length) res.push({ a, b, treffer });
    });
  });
  return res.sort((x, y) => y.treffer.length - x.treffer.length);
}

function gemeinsameInteressen() {
  const norm = u => String(u.interessen || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const res = [];
  for (let i = 0; i < S.users.length; i++) {
    for (let j = i + 1; j < S.users.length; j++) {
      const a = S.users[i], b = S.users[j];
      const schnitt = norm(a).filter(x => norm(b).includes(x));
      if (schnitt.length) res.push({ a, b, schnitt });
    }
  }
  return res.sort((x, y) => y.schnitt.length - x.schnitt.length);
}

function cBereichMatching() {
  const matches = suchBieteMatches();
  const interessen = gemeinsameInteressen();
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Suche ↔ Biete: ${matches.length} Treffer</h2></div>
    ${matches.map(m => `
    <div class="match-zeile">
      <div class="ez-mitte">
        <div class="ez-name">${ikon("suche",13)} ${esc(m.a.name)} sucht &nbsp;→&nbsp; ${ikon("matching",13)} ${esc(m.b.name)} bietet</div>
        <div class="ez-sub">„${esc(m.a.suche)}" ↔ „${esc(m.b.biete)}"</div>
        <div class="chip-reihe klein-chips">${m.treffer.map(t => `<span class="chip interesse">${esc(t)}</span>`).join("")}</div>
      </div>
      ${S.session ? `<button class="btn klein primaer" onclick="A.dmOeffnen('${S.session === m.a.id ? m.b.id : m.a.id}')">${ikon("mail",13)} Kontakt</button>` : ""}
    </div>`).join("") || '<p class="leer">Keine Treffer – je konkreter die „Suche"- und „Biete"-Felder in den Profilen, desto besser das Matching.</p>'}
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>Gemeinsame Interessen</h2></div>
    ${interessen.map(m => `
    <div class="match-zeile">
      <div class="ez-mitte">
        <div class="ez-name">${esc(m.a.name)} &amp; ${esc(m.b.name)}</div>
        <div class="chip-reihe klein-chips">${m.schnitt.map(t => `<span class="chip faehigkeit">${esc(t)}</span>`).join("")}</div>
      </div>
    </div>`).join("") || '<p class="leer">Noch keine überschneidenden Interessen in den Profilen.</p>'}
  </div>`;
}

/* ---- Community-Bereich: Meine nächsten Events ---- */

function naechsteEventsVon(userId, eigene) {
  const jetzt = heute();
  return S.events
    .filter(e => e.end >= jetzt)
    .filter(e => (S.teilnehmer[e.id] || []).includes(userId) || (eigene && ["Interessiert", "Angemeldet", "Bezahlt"].includes(statusVon(e.id))))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function cBereichMeineEvents() {
  const ich = angemeldeter() || S.users.find(u => u.istIch);
  if (!ich) return '<div class="karte"><p class="leer">Kein Nutzer angemeldet.</p></div>';
  const liste = naechsteEventsVon(ich.id, true);
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Nächste geplante Events von ${esc(ich.name)} (${liste.length})</h2><button class="btn klein" onclick="A.nav('auswahl')">Mehr entdecken →</button></div>
    ${liste.map(e => zeileEvent(e)).join("") || '<p class="leer">Keine anstehenden Events – trage dich bei einer Veranstaltung als Teilnehmer ein oder wähle in der Auswahlliste „Ja".</p>'}
    <p class="hinweis">Angezeigt werden anstehende Veranstaltungen, bei denen du als Teilnehmer eingetragen bist oder deren Anmeldestatus Interessiert/Angemeldet/Bezahlt ist. Diese Liste erscheint auch im Profil.</p>
  </div>`;
}

/* ---- Community-Bereiche: Mitfahrten & Treffen ---- */

function cBereichMitfahrten() {
  const alle = [];
  Object.entries(S.mitfahrten).forEach(([evId, arr]) => arr.forEach(m => alle.push({ ...m, evId })));
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Mitfahrgelegenheiten (${alle.length})</h2></div>
    ${alle.map(m => mitfahrtZeile(m, m.evId, true)).join("") || '<p class="leer">Keine Mitfahrgelegenheiten. Biete eine im Community-Tab einer Veranstaltung an.</p>'}
  </div>`;
}

function cBereichTreffen() {
  const alle = [];
  Object.entries(S.treffen).forEach(([evId, arr]) => arr.forEach(t => alle.push({ ...t, evId })));
  return `
  <div class="karte">
    <div class="karte-kopf"><h2>Geplante Treffen (${alle.length})</h2></div>
    ${alle.sort((a, b) => (a.zeit || "").localeCompare(b.zeit || "")).map(t => treffenZeile(t, t.evId, true)).join("") || '<p class="leer">Keine Treffen geplant.</p>'}
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
      ${u.linkedin ? `<a class="btn klein" href="${esc(u.linkedin)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="LinkedIn-Profil">in</a>` : ""}
      ${S.session && S.session !== u.id ? `<button class="btn klein" onclick="event.stopPropagation();A.dmOeffnen('${u.id}')" title="Nachricht senden">${ikon("mail",14)}</button>` : ""}
      <button class="btn klein" onclick="event.stopPropagation();A.userFormular('${u.id}')" title="Profil bearbeiten">${ikon("stift",14)}</button>
    </div>
    ${u.interessen || u.faehigkeiten ? `<div class="chip-reihe klein-chips">${chipListe(u.interessen, "interesse")}${chipListe(u.faehigkeiten, "faehigkeit")}</div>` : ""}
    ${u.projekt ? `<div class="profil-zeile"><b>Projekt:</b> ${esc(u.projekt)}</div>` : ""}
    ${u.suche || u.biete ? `
    <div class="such-biete">
      ${u.suche ? `<div class="sb-box sucht">${ikon("suche",12)} <b>Sucht:</b> ${esc(u.suche)}</div>` : ""}
      ${u.biete ? `<div class="sb-box bietet">${ikon("matching",12)} <b>Bietet:</b> ${esc(u.biete)}</div>` : ""}
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
      <tr><td>LinkedIn</td><td>${u.linkedin ? `<a href="${esc(u.linkedin)}" target="_blank" rel="noopener">${esc(u.linkedin)}</a>` : "–"}</td></tr>
      <tr><td>Sucht</td><td>${esc(u.suche) || "–"}</td></tr>
      <tr><td>Bietet</td><td>${esc(u.biete) || "–"}</td></tr>
      <tr><td>Nächste Events</td><td>${naechsteEventsVon(u.id, u.istIch || u.id === S.session).map(e => `<a href="#" onclick="closeModal();A.openEvent('${e.id}');return false">${esc(e.kurz || e.name)}</a> <span class="ez-sub">(${fmtDatumKurz(e.start)})</span>`).join(" · ") || "–"}</td></tr>
    </table>
    <div class="modal-aktionen">
      ${S.session && S.session !== u.id ? `<button class="btn" onclick="closeModal();A.dmOeffnen('${u.id}')">${ikon("mail",14)} Nachricht senden</button>` : ""}
      <button class="btn primaer" onclick="closeModal();A.userFormular('${u.id}')">${ikon("stift",14)} Bearbeiten</button>
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
      <label>LinkedIn-Profil <input name="linkedin" placeholder="https://www.linkedin.com/in/dein-name" value="${esc(u?.linkedin || "")}"></label>
      <div class="form-reihe">
        <label>Suche (was ich suche) <input name="suche" placeholder="z. B. Mitgründer, GPU-Sponsor, Beta-Tester" value="${esc(u?.suche || "")}"></label>
        <label>Biete (was ich anbiete) <input name="biete" placeholder="z. B. Mentoring, API-Zugang, Kontakte" value="${esc(u?.biete || "")}"></label>
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
    linkedin: f.get("linkedin"), suche: f.get("suche"), biete: f.get("biete")
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
  <button class="btn primaer" onclick="A.loginDialog()">${ikon("schloss",14)} Mit E-Mail anmelden</button></div>`;

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

/* ---------------- Ansicht: Posts (LinkedIn: vorher / live / Recap) ---------------- */

let postsEvId = null;
const POST_PHASEN = [
  ["vor", "Vor dem Termin", "SAVE THE DATE", "kalender-plus"],
  ["waehrend", "Während des Termins", "LIVE VOR ORT", "uhr"],
  ["nach", "Nach dem Termin", "MEIN RECAP", "haken"]
];

A.postsEvent = function (evId) { postsEvId = evId; render(); };

function hashtags(e) {
  const basis = ["#AI", "#KI", "#" + (e.kurz || e.name).replace(/[^\wäöüÄÖÜß]/g, ""), "#" + e.ort.replace(/[^\wäöüÄÖÜß]/g, ""), "#" + (e.kategorie || "Konferenz"), "#Networking"];
  return [...new Set(basis)].join(" ");
}

function postText(e, phase) {
  const gespeichert = S.posts[e.id]?.[phase];
  if (gespeichert != null) return gespeichert;
  const sessions = (S.sessions[e.id] || []);
  const highlights = [...sessions].sort((a, b) => (b.favorit ? 1 : 0) - (a.favorit ? 1 : 0)).slice(0, 3);
  const topSpeaker = [...(S.speaker[e.id] || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 2);
  const trends = [...(S.trends[e.id] || [])].sort((a, b) => (b.relevanz || 0) - (a.relevanz || 0)).slice(0, 3);
  const nugget = (S.nuggets[e.id] || [])[0];
  const treffen = (S.treffen[e.id] || []).length;
  const z = [];
  if (phase === "vor") {
    z.push(`📅 ${eventZeitraum(e)} – ich bin beim ${e.name} in ${e.ort}${e.venue ? " (" + e.venue + ")" : ""}!`);
    z.push("");
    if (highlights.length) {
      z.push("Worauf ich mich besonders freue:");
      highlights.forEach(s => z.push(`▪️ ${s.titel}${s.buehne ? " (" + s.buehne + ")" : ""}`));
      z.push("");
    } else if (e.beschreibung) {
      z.push(e.beschreibung);
      z.push("");
    }
    if (topSpeaker.length) { z.push(`Auf meiner Liste: ${topSpeaker.map(s => s.name + (s.firma ? " (" + s.firma + ")" : "")).join(" und ")}.`); z.push(""); }
    if (treffen) { z.push(`Wir organisieren schon ${treffen} Treffen vor Ort – Mittagessen, Austausch, Nachbetrachtung.`); z.push(""); }
    z.push("Wer von euch ist auch dort? Kommentiert kurz – ich freue mich über jedes Wiedersehen und neue Gesichter! 👋");
  } else if (phase === "waehrend") {
    z.push(`🔴 Live vom ${e.name} in ${e.ort}!`);
    z.push("");
    if (highlights.length) {
      z.push("Auf meinem Plan heute:");
      highlights.forEach(s => z.push(`▪️ ${s.start ? s.start + " Uhr · " : ""}${s.titel}`));
      z.push("");
    }
    if (nugget) { z.push(`Erste Erkenntnis des Tages: „${nugget.text}“${nugget.quelle ? " (" + nugget.quelle + ")" : ""}`); z.push(""); }
    else { z.push("Die ersten Gespräche laufen – die Energie hier ist großartig."); z.push(""); }
    z.push("Ihr seid auch hier? Schreibt mir eine Nachricht – Zeit für einen Kaffee findet sich immer. ☕");
  } else {
    z.push(`Das war der ${e.name} ${e.start.slice(0, 4)} in ${e.ort} – mein Recap. 🧵`);
    z.push("");
    const stats = [];
    if (sessions.length) stats.push(`${sessions.length} Sessions`);
    if ((S.speaker[e.id] || []).length) stats.push(`${(S.speaker[e.id] || []).length} Speaker`);
    if ((S.nuggets[e.id] || []).length) stats.push(`${(S.nuggets[e.id] || []).length} Kernerkenntnisse`);
    if (stats.length) { z.push(`In Zahlen: ${stats.join(" · ")}.`); z.push(""); }
    if (trends.length) {
      z.push("Meine Top-Trends:");
      trends.forEach((t, i) => z.push(`${i + 1}️⃣ ${t.titel}${t.beschreibung ? " – " + t.beschreibung : ""}`));
      z.push("");
    }
    if (nugget) { z.push(`Der Satz, der hängen bleibt: „${nugget.text}“${nugget.quelle ? " (" + nugget.quelle + ")" : ""}`); z.push(""); }
    z.push("Danke an alle für die Gespräche und Begegnungen – bis zum nächsten Mal! 🙌");
    z.push("Was war euer Highlight? Ab in die Kommentare.");
  }
  z.push("");
  z.push(hashtags(e));
  return z.join("\n");
}

/* ---- Post-Bild (1200×627, LinkedIn-Format) ---- */

function zeichnePostBild(cv, e, phase) {
  const [, , badge] = POST_PHASEN.find(p => p[0] === phase);
  const ctx = cv.getContext("2d");
  const W = cv.width = 1200, H = cv.height = 627;
  // Hintergrund
  ctx.fillStyle = "#0b0e17"; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(129,140,248,0.16)"); grad.addColorStop(1, e.farbe + "33");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // Deko-Kreise rechts
  ctx.globalAlpha = 0.22; ctx.fillStyle = e.farbe;
  ctx.beginPath(); ctx.arc(1080, 140, 180, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(1010, 520, 240, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  // Badge
  ctx.fillStyle = e.farbe; ctx.beginPath(); ctx.roundRect(70, 70, 34 + badge.length * 17, 54, 27); ctx.fill();
  ctx.fillStyle = "#0b0e17"; ctx.font = "bold 28px Arial"; ctx.textBaseline = "middle";
  ctx.fillText(badge, 92, 99);
  // Titel (umbrechen)
  ctx.fillStyle = "#e7eaf6"; ctx.font = "bold 62px Arial"; ctx.textBaseline = "alphabetic";
  const worte = e.name.split(" ");
  let zeile = "", y = 240;
  worte.forEach(w => {
    if (ctx.measureText(zeile + " " + w).width > 900 && zeile) { ctx.fillText(zeile, 70, y); y += 74; zeile = w; }
    else zeile = zeile ? zeile + " " + w : w;
  });
  ctx.fillText(zeile, 70, y);
  // Datum & Ort
  ctx.fillStyle = "#9aa3c7"; ctx.font = "38px Arial";
  ctx.fillText(`${eventZeitraum(e)}  ·  ${e.ort}${e.venue ? " – " + e.venue : ""}`.slice(0, 60), 70, y + 66);
  // Phasen-Zeile
  const sessions = (S.sessions[e.id] || []).length;
  const speaker = (S.speaker[e.id] || []).length;
  const trends = (S.trends[e.id] || []).length;
  let unten = "";
  if (phase === "vor") unten = "Wer ist auch dort? 👋";
  else if (phase === "waehrend") unten = "Jetzt vor Ort – meldet euch für einen Kaffee ☕";
  else unten = [sessions ? sessions + " Sessions" : "", speaker ? speaker + " Speaker" : "", trends ? trends + " Trends" : ""].filter(Boolean).join("  ·  ") || "Danke für die Begegnungen 🙌";
  ctx.fillStyle = "#22d3ee"; ctx.font = "bold 36px Arial";
  ctx.fillText(unten, 70, 520);
  // Fußzeile
  ctx.fillStyle = "#9aa3c7"; ctx.font = "26px Arial";
  ctx.fillText("AI Messe Guide", 70, 575);
}

function nachladenPostBilder() {
  if (route.view !== "posts" || !postsEvId) return;
  const e = ev(postsEvId);
  if (!e) return;
  POST_PHASEN.forEach(([phase]) => {
    const cv = document.getElementById("post-cv-" + phase);
    if (cv) zeichnePostBild(cv, e, phase);
  });
}

function vPosts() {
  const events = [...S.events].sort((a, b) => a.start.localeCompare(b.start));
  if (!postsEvId || !ev(postsEvId)) {
    const kommend = events.filter(e => e.end >= heute());
    postsEvId = (kommend[0] || events[0])?.id || null;
  }
  const e = ev(postsEvId);
  if (!e) return '<div class="kopf"><h1>Posts</h1></div><div class="karte"><p class="leer">Keine Veranstaltungen vorhanden.</p></div>';
  return `
  <div class="kopf"><h1>LinkedIn-Posts</h1><p class="unter">Drei fertige Posts je Veranstaltung – aus Messedaten, Agenda und Erkenntnissen generiert. Texte sind editierbar; Änderungen werden gespeichert.</p></div>
  <div class="werkzeuge">
    <select onchange="A.postsEvent(this.value)" style="max-width:420px;margin-top:0">
      ${events.map(x => `<option value="${x.id}" ${x.id === postsEvId ? "selected" : ""}>${esc(x.name)} (${fmtDatumKurz(x.start)})</option>`).join("")}
    </select>
    <span class="ez-sub">Datenbasis: ${(S.sessions[e.id] || []).length} Sessions · ${(S.speaker[e.id] || []).length} Speaker · ${(S.trends[e.id] || []).length} Trends · ${(S.nuggets[e.id] || []).length} Nuggets</span>
  </div>
  <div class="post-gitter">
    ${POST_PHASEN.map(([phase, label, , picon]) => `
    <div class="karte post-karte">
      <h2>${ikon(picon, 16)} ${label}</h2>
      <canvas id="post-cv-${phase}" class="post-bild" title="Share-Bild 1200×627 (LinkedIn)"></canvas>
      <textarea class="post-text" id="post-text-${phase}" rows="14" onchange="A.postSpeichern('${e.id}','${phase}',this.value)">${esc(postText(e, phase))}</textarea>
      <div class="knopf-reihe" style="margin-top:10px">
        <button class="btn klein primaer" onclick="A.postKopieren('${phase}')">${ikon("kopieren",13)} Text kopieren</button>
        <button class="btn klein" onclick="A.postBildDownload('${e.id}','${phase}')">${ikon("download",13)} Bild (PNG)</button>
        <button class="btn klein" onclick="A.postReset('${e.id}','${phase}')" title="Auf generierten Text zurücksetzen">${ikon("zuruecksetzen",13)}</button>
      </div>
    </div>`).join("")}
  </div>
  <p class="hinweis">Tipp: Je mehr Agenda (Programm-Tab), Speaker und Erkenntnisse (Trends &amp; Nuggets) gepflegt sind, desto konkreter werden die Posts. Bild herunterladen und bei LinkedIn zusammen mit dem Text hochladen.</p>`;
}

A.postSpeichern = function (evId, phase, text) {
  S.posts[evId] = S.posts[evId] || {};
  S.posts[evId][phase] = text;
  save();
};

A.postReset = function (evId, phase) {
  if (S.posts[evId]) delete S.posts[evId][phase];
  save(); render();
};

A.postKopieren = async function (phase) {
  const ta = document.getElementById("post-text-" + phase);
  if (!ta) return;
  try {
    await navigator.clipboard.writeText(ta.value);
    alert("Post-Text kopiert – bereit zum Einfügen bei LinkedIn.");
  } catch (e2) {
    ta.select();
    alert("Zwischenablage blockiert – Text ist markiert, bitte Strg+C drücken.");
  }
};

A.postBildDownload = function (evId, phase) {
  const cv = document.getElementById("post-cv-" + phase);
  const e = ev(evId);
  if (!cv || !e) return;
  cv.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `linkedin-${phase}-${(e.kurz || e.name).replace(/[^\wäöüÄÖÜß-]+/g, "_")}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
};

/* ---------------- Ansicht: Event-Detail ---------------- */

const TABS = [
  ["uebersicht", "Übersicht"], ["programm", "Programm"], ["speaker", "Speaker"],
  ["anmeldung", "Anmeldung & Bezahlung"], ["reise", "Reise"],
  ["kosten", "Kosten"], ["community", "Community"], ["materialien", "Materialien"],
  ["erkenntnisse", "Trends & Nuggets"]
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
    <button class="btn" onclick="A.eventFormular('${e.id}')">${ikon("stift",14)} Bearbeiten</button>
  </div>
  <div class="tabs">${TABS.map(([id, label]) => `<button class="tab ${route.tab === id ? 'aktiv' : ''}" onclick="A.tab('${id}')">${label}</button>`).join("")}</div>
  <div class="tab-inhalt">${tabInhalt(e)}</div>`;
}

function tabInhalt(e) {
  switch (route.tab) {
    case "uebersicht": return tUebersicht(e);
    case "programm": return tProgramm(e);
    case "speaker": return tSpeaker(e);
    case "anmeldung": return tAnmeldung(e);
    case "reise": return tReise(e);
    case "kosten": return tKostenEvent(e);
    case "community": return tCommunity(e);
    case "materialien": return tMaterialien(e);
    case "erkenntnisse": return tErkenntnisse(e);
  }
  return "";
}

/* ---- Tab: Übersicht ---- */

// Preisstaffel anzeigen: mehrere Ticketkategorien untereinander, sonst ab-Preis
function preisStaffel(e) {
  if (e.preise && e.preise.length) {
    return `<div class="preis-staffel">${e.preise.map(p => `
      <div class="preis-zeile"><span>${esc(p.typ)}</span>
        <span><b>${p.betrag > 0 ? fmtEUR(p.betrag) : "kostenlos"}</b>${p.hinweis ? ` <span class="ez-sub">(${esc(p.hinweis)})</span>` : ""}</span>
      </div>`).join("")}</div>`;
  }
  return e.preis > 0 ? "ab " + fmtEUR(e.preis) : "kostenlos";
}

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
        <tr><td>Ticketpreis</td><td>${preisStaffel(e)}</td></tr>
        <tr><td>Website</td><td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a>` : "–"}</td></tr>
      </table>
      <div class="knopf-reihe">
        <a class="btn" href="${gcalUrl(e)}" target="_blank" rel="noopener">${ikon("kalender-plus",15)} In Google Kalender eintragen</a>
        <button class="btn" onclick="A.icsEvent('${e.id}')">${ikon("download",15)} .ics-Datei</button>
        <button class="btn" onclick="A.steckbrief('${e.id}')">${ikon("kopieren",15)} „Wer kommt mit?“-Steckbrief kopieren</button>
        <button class="btn" onclick="A.paketExport('${e.id}')">${ikon("paket",15)} Event-Paket exportieren (fürs Team)</button>
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

/* ---- Tab: Programm (Sessions je Veranstaltung) ---- */

let progTag = "alle", progBuehne = "alle", progNurFavs = false, progWer = "alle";

A.progFilter = function (feld, wert) {
  if (feld === "tag") progTag = wert;
  if (feld === "buehne") progBuehne = wert;
  if (feld === "favs") progNurFavs = !progNurFavs;
  if (feld === "wer") progWer = wert;
  render();
};

function eventTage(e) {
  const tage = [];
  const d = new Date(e.start + "T12:00:00Z"), ende = new Date(e.end + "T12:00:00Z");
  while (d <= ende && tage.length < 21) { tage.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return tage;
}

function tProgramm(e) {
  const alle = (S.sessions[e.id] || []);
  const buehnen = ["alle", ...new Set(alle.map(s => s.buehne).filter(Boolean))];
  let liste = [...alle].sort((a, b) => (a.tag + a.start).localeCompare(b.tag + b.start));
  if (progTag !== "alle") liste = liste.filter(s => s.tag === progTag);
  if (progBuehne !== "alle") liste = liste.filter(s => s.buehne === progBuehne);
  if (progNurFavs) liste = liste.filter(s => s.favorit);
  if (progWer === "unbesetzt") liste = liste.filter(s => !(s.besucher || []).length);
  else if (progWer !== "alle") liste = liste.filter(s => (s.besucher || []).includes(progWer));
  const tage = eventTage(e);
  const abgedeckt = alle.filter(s => (s.besucher || []).length).length;
  let letzterTag = null;
  return `
  <div class="karte">
    <div class="karte-kopf">
      <h2>Programm – ${alle.length} Session${alle.length === 1 ? "" : "s"}${alle.filter(s => s.favorit).length ? ` · ★ ${alle.filter(s => s.favorit).length} Favoriten` : ""}${alle.length ? ` · ${ikon("community",14)} ${abgedeckt}/${alle.length} abgedeckt` : ""}</h2>
      <div style="display:flex;gap:8px">
        <label class="btn klein datei-btn" title="Sessions aus CSV oder JSON importieren">${ikon("upload",13)} Import<input type="file" accept=".csv,.json,text/csv,application/json" onchange="A.sessionsImport('${e.id}',this)"></label>
        <button class="btn primaer klein" onclick="A.sessionFormular('${e.id}')">+ Session</button>
      </div>
    </div>
    <div class="filter-gruppe" style="margin-bottom:6px">
      <button class="filter ${progTag === "alle" ? "aktiv" : ""}" onclick="A.progFilter('tag','alle')">Alle Tage</button>
      ${tage.map(t => `<button class="filter ${progTag === t ? "aktiv" : ""}" onclick="A.progFilter('tag','${t}')">${new Date(t + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</button>`).join("")}
    </div>
    <div class="filter-gruppe" style="margin-bottom:12px">
      ${buehnen.map(b => `<button class="filter ${progBuehne === b ? "aktiv" : ""}" onclick="A.progFilter('buehne','${esc(b)}')">${b === "alle" ? "Alle Bühnen" : esc(b)}</button>`).join("")}
      <button class="filter ${progNurFavs ? "aktiv" : ""}" onclick="A.progFilter('favs')">★ Nur Favoriten (Tagesplan)</button>
    </div>
    <div class="filter-gruppe" style="margin-bottom:12px">
      <span class="ez-sub" style="align-self:center">Team-Abdeckung:</span>
      <button class="filter ${progWer === "alle" ? "aktiv" : ""}" onclick="A.progFilter('wer','alle')">Alle</button>
      ${S.users.map(u => `<button class="filter ${progWer === u.id ? "aktiv" : ""}" onclick="A.progFilter('wer','${u.id}')" title="Laufzettel von ${esc(u.name)}">${esc(u.name)}</button>`).join("")}
      <button class="filter ${progWer === "unbesetzt" ? "aktiv" : ""}" onclick="A.progFilter('wer','unbesetzt')">❌ Unbesetzt</button>
    </div>
    ${liste.map(s => {
      const tagKopf = s.tag !== letzterTag ? `<div class="prog-tag">${new Date(s.tag + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</div>` : "";
      letzterTag = s.tag;
      const sprecher = (s.speakerIds || []).map(id => (S.speaker[e.id] || []).find(x => x.id === id)).filter(Boolean);
      const besucher = (s.besucher || []).map(user).filter(Boolean);
      return tagKopf + `
      <div class="reise-zeile">
        <span class="prog-zeit">${esc(s.start || "–")}${s.ende ? "–" + esc(s.ende) : ""}</span>
        <div class="ez-mitte">
          <div class="ez-name">${esc(s.titel)} ${s.buehne ? `<span class="tag">${esc(s.buehne)}</span>` : ""} ${s.thema ? `<span class="tag aktiv-tag">${esc(s.thema)}</span>` : ""}</div>
          <div class="ez-sub">${sprecher.map(sp => esc(sp.name)).join(", ")}${s.beschreibung ? (sprecher.length ? " · " : "") + esc(s.beschreibung) : ""}</div>
          ${besucher.length ? `<div class="chip-reihe klein-chips">${besucher.map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("")}</div>` : ""}
        </div>
        <button class="btn klein ${besucher.length ? "" : "nein-btn"}" onclick="A.sessionBesucher('${e.id}','${s.id}')" title="Wer aus dem Team geht rein?">${ikon("community",13)}${besucher.length ? " " + besucher.length : ""}</button>
        <button class="btn klein stern-btn ${s.favorit ? "voll" : ""}" onclick="A.sessionFav('${e.id}','${s.id}')" title="Als Favorit für den Tagesplan">${s.favorit ? "★" : "☆"}</button>
        <button class="btn klein" onclick="A.sessionFormular('${e.id}','${s.id}')">${ikon("stift",14)}</button>
      </div>`;
    }).join("") || `<p class="leer">${progNurFavs ? "Noch keine Favoriten markiert – ☆ an einer Session anklicken." : "Noch keine Sessions – Programmpunkte mit Tag, Zeit und Bühne anlegen und mit ★ den persönlichen Tagesplan bauen."}</p>`}
  </div>`;
}

/* ---- Programm-Import (CSV/JSON) – beseitigt das Abtippen großer Agenden ---- */

function parseCsv(text, trenner) {
  const zeilen = [];
  let feld = "", zeile = [], inQuote = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') { if (text[i + 1] === '"') { feld += '"'; i++; } else inQuote = false; }
      else feld += c;
    } else if (c === '"') inQuote = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some(x => x !== "")) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  if (feld !== "" || zeile.length) { zeile.push(feld); if (zeile.some(x => x !== "")) zeilen.push(zeile); }
  return zeilen;
}

const IMPORT_SPALTEN = {
  titel: ["titel", "title", "session", "name", "vortrag"],
  tag: ["tag", "datum", "date", "day"],
  start: ["start", "beginn", "von", "zeit", "time"],
  ende: ["ende", "end", "bis"],
  buehne: ["buehne", "bühne", "stage", "raum", "room", "location"],
  thema: ["thema", "track", "topic", "kategorie", "category"],
  beschreibung: ["beschreibung", "description", "abstract", "inhalt"],
  speaker: ["speaker", "sprecher", "referent", "referenten", "speakers"]
};

function normDatum(wert, fallback) {
  const w = String(wert || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  const m = w.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return fallback;
}

A.sessionsImport = function (evId, input) {
  const datei = input.files[0];
  if (!datei) return;
  const e = ev(evId);
  const leser = new FileReader();
  leser.onload = () => {
    input.value = "";
    try {
      let datensaetze = [];
      const text = String(leser.result);
      if (datei.name.toLowerCase().endsWith(".json") || text.trim().startsWith("[")) {
        const roh = JSON.parse(text);
        if (!Array.isArray(roh)) throw new Error("JSON muss ein Array von Session-Objekten sein.");
        datensaetze = roh;
      } else {
        const kopfzeile = text.split(/\r?\n/)[0];
        const trenner = (kopfzeile.match(/;/g) || []).length >= (kopfzeile.match(/,/g) || []).length ? ";" : ",";
        const zeilen = parseCsv(text, trenner);
        if (zeilen.length < 2) throw new Error("CSV braucht eine Kopfzeile und mindestens eine Datenzeile.");
        const koepfe = zeilen[0].map(k => k.trim().toLowerCase());
        const index = {};
        Object.entries(IMPORT_SPALTEN).forEach(([ziel, aliase]) => {
          index[ziel] = koepfe.findIndex(k => aliase.includes(k));
        });
        if (index.titel < 0) throw new Error('Spalte "titel" nicht gefunden. Erwartete Kopfzeile z. B.: titel;tag;start;ende;buehne;thema;speaker');
        datensaetze = zeilen.slice(1).map(z => {
          const o = {};
          Object.keys(IMPORT_SPALTEN).forEach(k => { if (index[k] >= 0) o[k] = (z[index[k]] || "").trim(); });
          return o;
        });
      }
      const arr = listOf(S.sessions, evId);
      const sprecherArr = listOf(S.speaker, evId);
      let neu = 0, uebersprungen = 0, neueSpeaker = 0;
      datensaetze.forEach(d => {
        const titel = String(d.titel || "").trim();
        if (!titel) { uebersprungen++; return; }
        const tag = normDatum(d.tag, e.start);
        const start = String(d.start || "").trim();
        if (arr.some(x => x.titel === titel && x.tag === tag && (x.start || "") === start)) { uebersprungen++; return; }
        const speakerIds = String(d.speaker || "").split(/[+]/).map(x => x.trim()).filter(Boolean).map(name => {
          let sp = sprecherArr.find(x => x.name === name);
          if (!sp) { sp = { id: uid(), name, rating: 0 }; sprecherArr.push(sp); neueSpeaker++; }
          return sp.id;
        });
        arr.push({
          id: uid(), titel, tag, start, ende: String(d.ende || "").trim(),
          buehne: String(d.buehne || "").trim(), thema: String(d.thema || "").trim(),
          beschreibung: String(d.beschreibung || "").trim(), speakerIds, favorit: false
        });
        neu++;
      });
      save(); render();
      openModal("Programm-Import abgeschlossen", `
        <ul style="padding-left:20px;font-size:14px;line-height:1.9">
          <li><b>${neu}</b> Sessions importiert</li>
          <li><b>${uebersprungen}</b> übersprungen (Duplikat oder ohne Titel)</li>
          <li><b>${neueSpeaker}</b> Speaker automatisch angelegt</li>
        </ul>
        <p class="hinweis">Duplikate werden über Titel + Tag + Startzeit erkannt – mehrfacher Import derselben Datei schadet nicht. Format: CSV mit Kopfzeile <code>titel;tag;start;ende;buehne;thema;speaker</code> (Reihenfolge egal, mehrere Speaker mit „+" trennen) oder JSON-Array gleicher Feldnamen.</p>
        <div class="modal-aktionen"><button class="btn primaer" onclick="closeModal()">Fertig</button></div>`);
    } catch (fehler) {
      alert("Import fehlgeschlagen: " + fehler.message);
    }
  };
  leser.readAsText(datei);
};

A.sessionFav = function (evId, sessionId) {
  const s = listOf(S.sessions, evId).find(x => x.id === sessionId);
  if (s) { s.favorit = !s.favorit; save(); render(); }
};

A.sessionBesucher = function (evId, sessionId) {
  const s = listOf(S.sessions, evId).find(x => x.id === sessionId);
  if (!s) return;
  s.besucher = s.besucher || [];
  openModal("Wer geht rein? – " + s.titel, `
    <p class="hinweis" style="margin-bottom:10px">Team-Abdeckung: Wer besucht diese Session und liefert danach Notizen/Fotos?</p>
    <div class="chip-reihe">
      ${S.users.map(u => `
      <label class="chip waehlbar ${s.besucher.includes(u.id) ? "gewaehlt" : ""}">
        <input type="checkbox" ${s.besucher.includes(u.id) ? "checked" : ""} onchange="A.sessionBesucherToggle('${evId}','${sessionId}','${u.id}',this)">
        <span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}
      </label>`).join("")}
    </div>
    <div class="modal-aktionen"><button class="btn primaer" onclick="closeModal()">Fertig</button></div>`);
};

A.sessionBesucherToggle = function (evId, sessionId, userId, box) {
  const s = listOf(S.sessions, evId).find(x => x.id === sessionId);
  if (!s) return;
  s.besucher = s.besucher || [];
  const i = s.besucher.indexOf(userId);
  if (i >= 0) s.besucher.splice(i, 1); else s.besucher.push(userId);
  box.parentElement.classList.toggle("gewaehlt", i < 0);
  save();
};

A.sessionFormular = function (evId, sessionId) {
  const e = ev(evId);
  const s = sessionId ? listOf(S.sessions, evId).find(x => x.id === sessionId) : null;
  const sp = S.speaker[evId] || [];
  openModal(s ? "Session bearbeiten" : "Session hinzufügen", `
    <form onsubmit="return A.sessionSpeichern(event,'${evId}','${sessionId || ""}')">
      <label>Titel <input name="titel" required value="${esc(s?.titel || "")}"></label>
      <div class="form-reihe">
        <label>Tag <input type="date" name="tag" required min="${e.start}" max="${e.end}" value="${s?.tag || e.start}"></label>
        <label>Bühne / Raum <input name="buehne" placeholder="z. B. Main Stage, Halle 2" value="${esc(s?.buehne || "")}"></label>
      </div>
      <div class="form-reihe">
        <label>Beginn <input type="time" name="start" value="${s?.start || ""}"></label>
        <label>Ende <input type="time" name="ende" value="${s?.ende || ""}"></label>
      </div>
      <label>Thema <input name="thema" placeholder="z. B. GenAI, Robotik, AI Act" value="${esc(s?.thema || "")}"></label>
      <label>Beschreibung <input name="beschreibung" value="${esc(s?.beschreibung || "")}"></label>
      <label>Speaker</label>
      <div class="chip-reihe">
        ${sp.map(x => `<label class="chip waehlbar ${(s?.speakerIds || []).includes(x.id) ? "gewaehlt" : ""}"><input type="checkbox" name="sp" value="${x.id}" ${(s?.speakerIds || []).includes(x.id) ? "checked" : ""} onchange="this.parentElement.classList.toggle('gewaehlt',this.checked)">${esc(x.name)}</label>`).join("") || '<span class="leer">Noch keine Speaker angelegt (Tab „Speaker").</span>'}
      </div>
      <div class="modal-aktionen">
        ${s ? `<button type="button" class="btn gefahr" onclick="A.sessionLoeschen('${evId}','${s.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.sessionSpeichern = function (evt, evId, sessionId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = {
    titel: f.get("titel"), tag: f.get("tag"), start: f.get("start"), ende: f.get("ende"),
    buehne: f.get("buehne"), thema: f.get("thema"), beschreibung: f.get("beschreibung"), speakerIds: f.getAll("sp")
  };
  const arr = listOf(S.sessions, evId);
  if (sessionId) Object.assign(arr.find(x => x.id === sessionId), daten);
  else arr.push({ id: uid(), ...daten, favorit: false });
  save(); closeModal(); render();
  return false;
};

A.sessionLoeschen = function (evId, sessionId) {
  S.sessions[evId] = (S.sessions[evId] || []).filter(x => x.id !== sessionId);
  save(); closeModal(); render();
};

/* ---- Tab: Speaker (Verzeichnis, Bio, Promi-Rating, Firmen) ---- */

let spThemaFilter = "alle";
A.spThema = function (t) { spThemaFilter = t; render(); };

function tSpeaker(e) {
  const alle = S.speaker[e.id] || [];
  const themen = ["alle", ...new Set(alle.map(s => s.thema).filter(Boolean))];
  const liste = (spThemaFilter === "alle" ? alle : alle.filter(s => s.thema === spThemaFilter))
    .slice().sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
  const firmen = {};
  alle.forEach(s => { if (s.firma) (firmen[s.firma] = firmen[s.firma] || []).push(s); });
  return `
  <div class="karte">
    <div class="karte-kopf">
      <h2>Speaker (${alle.length})</h2>
      <button class="btn primaer klein" onclick="A.speakerFormular('${e.id}')">+ Speaker</button>
    </div>
    <div class="filter-gruppe" style="margin-bottom:12px">
      ${themen.map(t => `<button class="filter ${spThemaFilter === t ? "aktiv" : ""}" onclick="A.spThema('${esc(t)}')">${t === "alle" ? "Alle Themen" : esc(t)}</button>`).join("")}
    </div>
    <div class="profil-gitter">
      ${liste.map(s => `
      <div class="profil-karte" onclick="A.speakerDetail('${e.id}','${s.id}')">
        <div class="profil-kopf">
          <span class="avatar" style="background:#4c5686">${esc((s.name || "?")[0])}</span>
          <div class="ez-mitte">
            <div class="ez-name">${esc(s.name)} ${s.thema ? `<span class="tag aktiv-tag">${esc(s.thema)}</span>` : ""}</div>
            <div class="ez-sub">${esc([s.rolle, s.firma].filter(Boolean).join(" · ")) || "–"}</div>
          </div>
          <button class="btn klein" onclick="event.stopPropagation();A.speakerFormular('${e.id}','${s.id}')">${ikon("stift",14)}</button>
        </div>
        <div class="sterne" style="margin-top:8px">
          ${[1, 2, 3, 4, 5].map(n => `<button class="stern ${n <= (s.rating || 0) ? "voll" : ""}" onclick="event.stopPropagation();A.speakerRating('${e.id}','${s.id}',${n})" title="Promi-Rating ${n}/5">★</button>`).join("")}
        </div>
        ${s.bio ? `<div class="profil-zeile">${esc(s.bio.slice(0, 140))}${s.bio.length > 140 ? "…" : ""}</div>` : ""}
      </div>`).join("") || '<p class="leer">Noch keine Speaker – Referenten mit Firma, Thema und Bio anlegen; das Firmenverzeichnis unten entsteht automatisch.</p>'}
    </div>
  </div>
  <div class="karte">
    <div class="karte-kopf"><h2>${ikon("gebaeude",16)} Firmen (${Object.keys(firmen).length})</h2></div>
    ${Object.entries(firmen).sort((a, b) => b[1].length - a[1].length).map(([firma, sp]) => `
    <div class="reise-zeile">
      <span class="reise-icon">${ikon("gebaeude",20)}</span>
      <div class="ez-mitte">
        <div class="ez-name">${esc(firma)} <span class="tag">${sp.length} Speaker</span></div>
        <div class="ez-sub">${sp.map(x => esc(x.name)).join(", ")}${[...new Set(sp.map(x => x.thema).filter(Boolean))].length ? " · Themen: " + [...new Set(sp.map(x => x.thema).filter(Boolean))].map(esc).join(", ") : ""}</div>
      </div>
    </div>`).join("") || '<p class="leer">Wird automatisch aus den Firmen der Speaker aufgebaut.</p>'}
  </div>`;
}

A.speakerRating = function (evId, spId, n) {
  const s = listOf(S.speaker, evId).find(x => x.id === spId);
  if (s) { s.rating = s.rating === n ? 0 : n; save(); render(); }
};

A.speakerDetail = function (evId, spId) {
  const s = (S.speaker[evId] || []).find(x => x.id === spId);
  if (!s) return;
  const sessions = (S.sessions[evId] || []).filter(x => (x.speakerIds || []).includes(spId));
  openModal("Speaker: " + s.name, `
    <table class="info-tabelle">
      <tr><td>Rolle</td><td>${esc(s.rolle) || "–"}</td></tr>
      <tr><td>Firma</td><td>${esc(s.firma) || "–"}</td></tr>
      <tr><td>Thema</td><td>${s.thema ? `<span class="tag aktiv-tag">${esc(s.thema)}</span>` : "–"}</td></tr>
      <tr><td>Rating</td><td><span class="sterne-mini">${"★".repeat(s.rating || 0)}</span>${s.rating ? ` ${s.rating}/5` : "–"}</td></tr>
      <tr><td>LinkedIn</td><td>${s.linkedin ? `<a href="${esc(s.linkedin)}" target="_blank" rel="noopener">${esc(s.linkedin)}</a>` : "–"}</td></tr>
      <tr><td>Bio</td><td>${esc(s.bio) || "–"}</td></tr>
      <tr><td>Sessions</td><td>${sessions.map(x => `${esc(x.titel)} <span class="ez-sub">(${fmtDatumKurz(x.tag)} ${esc(x.start || "")})</span>`).join("<br>") || "–"}</td></tr>
    </table>
    <div class="modal-aktionen">
      <button class="btn primaer" onclick="closeModal();A.speakerFormular('${evId}','${spId}')">${ikon("stift",14)} Bearbeiten</button>
    </div>`);
};

A.speakerFormular = function (evId, spId) {
  const s = spId ? listOf(S.speaker, evId).find(x => x.id === spId) : null;
  openModal(s ? "Speaker bearbeiten" : "Speaker hinzufügen", `
    <form onsubmit="return A.speakerSpeichern(event,'${evId}','${spId || ""}')">
      <div class="form-reihe">
        <label>Name <input name="name" required value="${esc(s?.name || "")}"></label>
        <label>Rolle <input name="rolle" placeholder="z. B. CTO, Forscherin" value="${esc(s?.rolle || "")}"></label>
      </div>
      <div class="form-reihe">
        <label>Firma / Organisation <input name="firma" value="${esc(s?.firma || "")}"></label>
        <label>Thema <input name="thema" placeholder="z. B. GenAI, Robotik" value="${esc(s?.thema || "")}"></label>
      </div>
      <label>LinkedIn <input name="linkedin" placeholder="https://www.linkedin.com/in/…" value="${esc(s?.linkedin || "")}"></label>
      <label>Bio <textarea name="bio" rows="4">${esc(s?.bio || "")}</textarea></label>
      <div class="modal-aktionen">
        ${s ? `<button type="button" class="btn gefahr" onclick="A.speakerLoeschen('${evId}','${s.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.speakerSpeichern = function (evt, evId, spId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { name: f.get("name"), rolle: f.get("rolle"), firma: f.get("firma"), thema: f.get("thema"), linkedin: f.get("linkedin"), bio: f.get("bio") };
  const arr = listOf(S.speaker, evId);
  if (spId) Object.assign(arr.find(x => x.id === spId), daten);
  else arr.push({ id: uid(), ...daten, rating: 0 });
  save(); closeModal(); render();
  return false;
};

A.speakerLoeschen = function (evId, spId) {
  S.speaker[evId] = (S.speaker[evId] || []).filter(x => x.id !== spId);
  (S.sessions[evId] || []).forEach(s => { s.speakerIds = (s.speakerIds || []).filter(id => id !== spId); });
  save(); closeModal(); render();
};

/* ---- Zusammenarbeit ohne Server: Steckbrief & Event-Paket ---- */

A.steckbrief = async function (evId) {
  const e = ev(evId);
  if (!e) return;
  const treffen = (S.treffen[evId] || []).map(t => `• ${t.titel || t.typ}${t.zeit ? " (" + t.zeit.replace("T", " ") + ")" : ""}`).join("\n");
  const mitfahrten = (S.mitfahrten[evId] || []).map(m => `• ab ${m.von}${m.abfahrt ? ", " + m.abfahrt.replace("T", " ") : ""} (${Math.max(0, m.plaetze - (m.mitfahrer || []).length)} Plätze frei)`).join("\n");
  const text = [
    `🤖 ${e.name}`,
    `📅 ${eventZeitraum(e)}`,
    `📍 ${e.ort}${e.venue ? " – " + e.venue : ""}`,
    e.preis > 0 ? `🎟 Ticket ab ${fmtEUR(e.preis)}` : "🎟 Eintritt frei",
    e.url ? `🔗 ${e.url}` : "",
    e.beschreibung ? `\n${e.beschreibung}` : "",
    treffen ? `\n🍽 Geplante Treffen:\n${treffen}` : "",
    mitfahrten ? `\n🚘 Mitfahrgelegenheiten:\n${mitfahrten}` : "",
    `\nWer kommt mit? Sag kurz Bescheid!`
  ].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    alert("Steckbrief in die Zwischenablage kopiert – einfach in WhatsApp, Teams oder E-Mail einfügen.");
  } catch (err) {
    openModal("Steckbrief kopieren", `<textarea rows="12" style="width:100%">${esc(text)}</textarea><p class="hinweis">Text markieren und mit Strg+C kopieren.</p>`);
  }
};

// Event-Paket: teilt Planungsdaten, NICHT die persönlichen (Kosten, Reisen, Anmeldung).
const PAKET_LISTEN = ["sessions", "speaker", "treffen", "mitfahrten", "beitraege", "notizen", "trends", "nuggets"];

A.paketExport = function (evId) {
  const e = ev(evId);
  if (!e) return;
  // referenzierte Nutzer einsammeln (nur unkritische Profilfelder)
  const ids = new Set(S.teilnehmer[evId] || []);
  (S.treffen[evId] || []).forEach(t => (t.teilnehmer || []).forEach(id => ids.add(id)));
  (S.mitfahrten[evId] || []).forEach(m => { ids.add(m.fahrerId); (m.mitfahrer || []).forEach(id => ids.add(id)); });
  (S.beitraege[evId] || []).forEach(b => ids.add(b.userId));
  (S.sessions[evId] || []).forEach(s => (s.besucher || []).forEach(id => ids.add(id)));
  const paket = {
    format: "aimg-event-paket", version: 1,
    exportiertAm: new Date().toISOString(),
    exportiertVon: angemeldeter()?.name || "",
    event: e,
    teilnehmer: S.teilnehmer[evId] || [],
    nutzer: [...ids].map(user).filter(Boolean).map(u => ({ id: u.id, name: u.name, farbe: u.farbe, stadt: u.stadt, firma: u.firma }))
  };
  PAKET_LISTEN.forEach(k => paket[k] = S[k][evId] || []);
  const blob = new Blob([JSON.stringify(paket, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "event-paket-" + (e.kurz || e.name).replace(/[^\wäöüÄÖÜß-]+/g, "_") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  alert("Event-Paket exportiert. Persönliche Daten (Kosten, Reisen, Anmeldung) und Dateien sind NICHT enthalten – nur die gemeinsame Planung.");
};

function mergeListe(ziel, quelle) {
  let neu = 0;
  (quelle || []).forEach(item => {
    if (!item || !item.id) return;
    if (!ziel.some(x => x.id === item.id)) { ziel.push(item); neu++; }
  });
  return neu;
}

A.paketImport = function (input) {
  const datei = input.files[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    input.value = "";
    try {
      const p = JSON.parse(leser.result);
      if (p.format !== "aimg-event-paket" || !p.event?.id) throw new Error("Das ist kein Event-Paket des AI Messe Guide.");
      const evId = p.event.id;
      const bericht = [];
      if (!ev(evId)) {
        S.events.push(p.event);
        bericht.push("Veranstaltung „" + p.event.name + "“ neu angelegt");
      } else {
        bericht.push("Veranstaltung „" + ev(evId).name + "“ gefunden – bestehende Daten bleiben erhalten");
      }
      let neueNutzer = 0;
      (p.nutzer || []).forEach(n => {
        if (n?.id && !user(n.id)) { S.users.push({ ...n, istIch: false }); neueNutzer++; }
      });
      if (neueNutzer) bericht.push(neueNutzer + " Mitglied(er) übernommen");
      PAKET_LISTEN.forEach(k => {
        const n = mergeListe(listOf(S[k], evId), p[k]);
        if (n) bericht.push(n + " × " + k);
      });
      const teiln = listOf(S.teilnehmer, evId);
      let neueTeiln = 0;
      (p.teilnehmer || []).forEach(id => { if (user(id) && !teiln.includes(id)) { teiln.push(id); neueTeiln++; } });
      if (neueTeiln) bericht.push(neueTeiln + " Teilnehmer ergänzt");
      save(); render();
      openModal("Event-Paket zusammengeführt", `
        <p class="hinweis" style="margin-bottom:10px">${p.exportiertVon ? "Von: " + esc(p.exportiertVon) + " · " : ""}${p.exportiertAm ? "Stand: " + esc(p.exportiertAm.slice(0, 10)) : ""}</p>
        <ul style="padding-left:20px;font-size:14px;line-height:1.8">${bericht.map(z => `<li>${esc(z)}</li>`).join("")}</ul>
        <p class="hinweis">Zusammenführen statt Ersetzen: Vorhandenes wurde nicht überschrieben, nur Neues ergänzt (idempotent – mehrfacher Import schadet nicht).</p>
        <div class="modal-aktionen"><button class="btn primaer" onclick="closeModal();A.openEvent('${evId}')">Zur Veranstaltung →</button></div>`);
    } catch (e2) {
      alert("Import fehlgeschlagen: " + e2.message);
    }
  };
  leser.readAsText(datei);
};

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
          <span class="reise-icon">${vmIkon(r.art)}</span>
          <div class="ez-mitte">
            <div class="ez-name">${esc(r.von || "?")} → ${esc(r.nach || "?")} <span class="tag">${esc(r.art)}</span></div>
            <div class="ez-sub">${r.abfahrt ? "Ab " + esc(r.abfahrt.replace("T", " ")) : ""}${r.ankunft ? " · An " + esc(r.ankunft.replace("T", " ")) : ""}${r.notiz ? " · " + esc(r.notiz) : ""}</div>
          </div>
          <b>${fmtEUR(r.kosten)}</b>
          <button class="btn klein" onclick="A.reiseFormular('${e.id}','${r.id}')">${ikon("stift",14)}</button>
        </div>`).join("") || '<p class="leer">Noch keine Reise geplant – Hinfahrt, Rückfahrt und Transfers als Abschnitte anlegen.</p>'}
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2>Übernachtung</h2><button class="btn primaer klein" onclick="A.hotelFormular('${e.id}')">+ Unterkunft</button></div>
      ${hotels.map(h => `
        <div class="reise-zeile">
          <span class="reise-icon">${ikon("bett",20)}</span>
          <div class="ez-mitte">
            <div class="ez-name">${esc(h.name)}</div>
            <div class="ez-sub">${fmtDatum(h.checkin)} – ${fmtDatum(h.checkout)}${h.notiz ? " · " + esc(h.notiz) : ""}</div>
          </div>
          <b>${fmtEUR(h.kosten)}</b>
          <button class="btn klein" onclick="A.hotelFormular('${e.id}','${h.id}')">${ikon("stift",14)}</button>
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
      <div style="display:flex;gap:8px">
        <button class="btn klein" onclick="A.reisekostenPdf('${e.id}')">${ikon("beleg",13)} Abrechnung (PDF)</button>
        <button class="btn primaer klein" onclick="A.kostenFormular('${e.id}')">+ Kostenposten</button>
      </div>
    </div>
    <table class="tabelle">
      <thead><tr><th>Kategorie</th><th>Beschreibung</th><th>Datum</th><th class="rechts">Netto</th><th class="rechts">USt</th><th class="rechts">Brutto (EUR)</th><th></th></tr></thead>
      <tbody>${zeilen.map(z => `
        <tr>
          <td><span class="tag">${z.kategorie}</span></td><td>${esc(z.beschreibung)}</td><td>${fmtDatum(z.datum)}</td>
          <td class="rechts">${z.netto != null ? fmtEUR(z.netto) : "–"}</td>
          <td class="rechts">${z.ust != null ? fmtEUR(z.ust) + (z.ustSatz != null ? ` <span class="ez-sub">(${z.ustSatz} %)</span>` : "") : "–"}</td>
          <td class="rechts">${fmtEUR(z.betrag)}${z.waehrung && z.waehrung !== "EUR" ? `<div class="ez-sub">${(z.betragOriginal ?? 0).toLocaleString("de-DE")} ${esc(z.waehrung)} @ ${z.kurs}</div>` : ""}</td>
          <td class="rechts">${z.quelle === "manuell" ? `<button class="btn klein" onclick="A.kostenFormular('${e.id}','${z.id}')">${ikon("stift",14)}</button>` : `<span class="ez-sub" title="Automatisch aus ${z.quelle === 'anmeldung' ? 'Anmeldung' : z.quelle === 'reise' ? 'Reiseplanung' : 'Übernachtung'}">auto</span>`}</td>
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

/* ---- Reisekostenabrechnung als druckbares PDF (über den Browser-Druckdialog) ---- */

function erzeugeAbrechnungHtml(evId) {
  const e = ev(evId);
  if (!e) return "";
  const nutzer = angemeldeter() || S.users.find(u => u.istIch) || { name: "" };
  const zeilen = kostenZeilen(evId);
  const nettoSumme = zeilen.reduce((s, z) => s + (z.netto ?? z.betrag), 0);
  const ustSumme = zeilen.reduce((s, z) => s + (z.ust ?? 0), 0);
  const bruttoSumme = zeilen.reduce((s, z) => s + z.betrag, 0);
  const eur = n => (Number(n) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const reisen = S.reisen[evId] || [];
  const hotels = S.uebernachtungen[evId] || [];
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Reisekostenabrechnung ${esc(e.kurz || e.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 40px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 22px 0 6px; }
    .kopf { color: #444; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; }
    th { background: #eee; } .r { text-align: right; }
    .summe td { font-weight: bold; background: #f5f5f5; }
    .unterschrift { margin-top: 60px; display: flex; gap: 60px; }
    .unterschrift div { border-top: 1px solid #333; padding-top: 4px; width: 240px; font-size: 11px; color: #444; }
    .fuss { margin-top: 30px; font-size: 10px; color: #777; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
  <h1>Reisekostenabrechnung</h1>
  <div class="kopf">
    <b>${esc(nutzer.name)}</b>${nutzer.firma ? " · " + esc(nutzer.firma) : ""}<br>
    Veranstaltung: <b>${esc(e.name)}</b> · ${eventZeitraum(e)} · ${esc(e.ort)}${e.venue ? " (" + esc(e.venue) + ")" : ""}
  </div>
  ${reisen.length ? `<h2>Reiseverlauf</h2><table><tr><th>Verkehrsmittel</th><th>Strecke</th><th>Abfahrt</th><th>Ankunft</th><th class="r">Kosten</th></tr>
    ${reisen.map(r => `<tr><td>${esc(r.art)}</td><td>${esc(r.von)} → ${esc(r.nach)}</td><td>${esc((r.abfahrt || "").replace("T", " "))}</td><td>${esc((r.ankunft || "").replace("T", " "))}</td><td class="r">${eur(r.kosten)}</td></tr>`).join("")}</table>` : ""}
  ${hotels.length ? `<h2>Übernachtungen</h2><table><tr><th>Unterkunft</th><th>Check-in</th><th>Check-out</th><th class="r">Kosten</th></tr>
    ${hotels.map(h => `<tr><td>${esc(h.name)}</td><td>${fmtDatum(h.checkin)}</td><td>${fmtDatum(h.checkout)}</td><td class="r">${eur(h.kosten)}</td></tr>`).join("")}</table>` : ""}
  <h2>Kostenaufstellung</h2>
  <table>
    <tr><th>Kategorie</th><th>Beschreibung</th><th>Datum</th><th class="r">Netto</th><th class="r">USt</th><th class="r">Brutto</th><th>Beleg-Währung</th></tr>
    ${zeilen.map(z => `<tr><td>${esc(z.kategorie)}</td><td>${esc(z.beschreibung)}</td><td>${fmtDatum(z.datum)}</td><td class="r">${z.netto != null ? eur(z.netto) : "–"}</td><td class="r">${z.ust != null ? eur(z.ust) + (z.ustSatz != null ? " (" + z.ustSatz + " %)" : "") : "–"}</td><td class="r">${eur(z.betrag)}</td><td>${z.waehrung && z.waehrung !== "EUR" ? esc((z.betragOriginal ?? "") + " " + z.waehrung + " @ " + z.kurs) : "EUR"}</td></tr>`).join("")}
    <tr class="summe"><td colspan="3">Summe</td><td class="r">${eur(nettoSumme)}</td><td class="r">${eur(ustSumme)}</td><td class="r">${eur(bruttoSumme)}</td><td></td></tr>
  </table>
  <p style="margin-top:14px">Erstattungsbetrag: <b style="font-size:14px">${eur(bruttoSumme)}</b></p>
  <div class="unterschrift"><div>Datum, Unterschrift Antragsteller/in</div><div>Datum, Unterschrift Genehmigung</div></div>
  <div class="fuss">Netto-Summe enthält Auto-Posten (Eintritt/Fahrt/Hotel) zum Bruttowert, sofern dort keine USt erfasst ist. Erstellt mit AI Messe Guide am ${new Date().toLocaleDateString("de-DE")}.</div>
  <script>window.print()</${"script"}>
  </body></html>`;
}

A.reisekostenPdf = function (evId) {
  const html = erzeugeAbrechnungHtml(evId);
  if (!html) return;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const fenster = window.open(url, "_blank");
  if (!fenster) alert("Pop-up blockiert – bitte Pop-ups für diese Seite erlauben.");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

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
      <div class="karte">
        <div class="karte-kopf"><h2>${ikon("haken",16)} Aufgaben (${(S.aufgaben[e.id] || []).filter(a => !a.erledigt).length} offen)</h2><button class="btn primaer klein" onclick="A.aufgabeFormular('${e.id}')">+ Aufgabe</button></div>
        ${(S.aufgaben[e.id] || []).map(a => `
        <div class="reise-zeile">
          <input type="checkbox" ${a.erledigt ? "checked" : ""} onchange="A.aufgabeErledigt('${e.id}','${a.id}')" style="width:18px;height:18px;margin:0;flex-shrink:0">
          <div class="ez-mitte">
            <div class="ez-name" style="${a.erledigt ? "text-decoration:line-through;opacity:.55" : ""}">${esc(a.text)}</div>
            ${a.wer && user(a.wer) ? `<div class="ez-sub">→ ${esc(user(a.wer).name)}</div>` : ""}
          </div>
          <button class="btn klein" onclick="A.aufgabeFormular('${e.id}','${a.id}')">${ikon("stift",14)}</button>
        </div>`).join("") || '<p class="leer">Keine Aufgaben – z. B. „Tisch reservieren", „Visitenkarten mitbringen", „Nachbetrachtung schreiben".</p>'}
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
      <button class="btn primaer" onclick="A.loginDialog()">${ikon("schloss",14)} Mit E-Mail anmelden</button>
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
    <span class="reise-icon">${ikon("essen",20)}</span>
    <div class="ez-mitte">
      <div class="ez-name">${esc(t.titel || t.typ)} <span class="tag">${esc(t.typ)}</span>${mitEvent ? ` <a href="#" class="tag" onclick="A.openEvent('${evId}','community');return false">${esc(ev(evId)?.kurz || "?")}</a>` : ""}</div>
      <div class="ez-sub">${t.zeit ? esc(t.zeit.replace("T", " ")) + " · " : ""}${esc(t.ort || "Ort offen")}${t.notiz ? " · " + esc(t.notiz) : ""}</div>
      <div class="chip-reihe klein-chips">${teiln.map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("")}</div>
    </div>
    <button class="btn klein ${dabei ? "" : "primaer"}" onclick="A.treffenToggle('${evId}','${t.id}')">${dabei ? "Absagen" : "Teilnehmen"}</button>
    <button class="btn klein ${t.vorschlaege?.length ? "vlt-btn gewaehlt-vlt" : ""}" onclick="A.abstimmung('${evId}','${t.id}')" title="Terminabstimmung (Doodle-light)">${ikon("abstimmen",14)}${t.vorschlaege?.length ? " " + t.vorschlaege.length : ""}</button>
    <button class="btn klein" onclick="A.treffenEinladung('${evId}','${t.id}')" title="Kalender-Einladung verschicken">${ikon("kalender-plus",14)}</button>
    <button class="btn klein" onclick="A.treffenFormular('${evId}','${t.id}')">${ikon("stift",14)}</button>
  </div>`;
}

/* ---- Treffen: Kalender-Einladung (.ics + Mail-Entwurf) ---- */

function icsTreffenDatei(t, e) {
  const beginn = new Date(t.zeit || e.start + "T12:00");
  const ende = new Date(beginn.getTime() + 90 * 60000);
  const p = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AI Messe Guide 2026//DE", "METHOD:PUBLISH",
    "BEGIN:VEVENT", "UID:" + t.id + "@aimg2026",
    "DTSTART:" + fmt(beginn), "DTEND:" + fmt(ende),
    "SUMMARY:" + icsEsc((t.titel || t.typ) + " – " + (e.kurz || e.name)),
    "LOCATION:" + icsEsc(t.ort || e.venue || e.ort),
    "DESCRIPTION:" + icsEsc("Treffen im Rahmen von " + e.name + (t.notiz ? " – " + t.notiz : "")),
    "END:VEVENT", "END:VCALENDAR"];
  const blob = new Blob([zeilen.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "treffen-" + (t.titel || t.typ).replace(/[^\wäöüÄÖÜß-]+/g, "_") + ".ics";
  a.click();
  URL.revokeObjectURL(a.href);
}

A.treffenEinladung = function (evId, treffenId) {
  const t = (S.treffen[evId] || []).find(x => x.id === treffenId);
  const e = ev(evId);
  if (!t || !e) return;
  const teiln = (t.teilnehmer || []).map(user).filter(Boolean);
  const mails = teiln.map(u => u.email).filter(Boolean);
  const betreff = encodeURIComponent(`Einladung: ${t.titel || t.typ} – ${e.kurz || e.name}`);
  const body = encodeURIComponent(
    `Hallo zusammen,\n\nEinladung zu unserem Treffen bei ${e.name}:\n\n` +
    `Was: ${t.titel || t.typ}\nWann: ${t.zeit ? t.zeit.replace("T", " ") + " Uhr" : "wird noch abgestimmt"}\nWo: ${t.ort || e.venue || e.ort}\n` +
    (t.notiz ? `Hinweis: ${t.notiz}\n` : "") +
    `\nDie angehängte/heruntergeladene .ics-Datei legt den Termin direkt in euren Kalender.\n\nBis dann!`);
  openModal("Treffen einladen: " + (t.titel || t.typ), `
    <table class="info-tabelle">
      <tr><td>Wann</td><td>${t.zeit ? esc(t.zeit.replace("T", " ")) + " Uhr" : "noch offen – erst abstimmen"}</td></tr>
      <tr><td>Wo</td><td>${esc(t.ort || e.venue || e.ort)}</td></tr>
      <tr><td>Teilnehmer</td><td>${teiln.map(u => esc(u.name)).join(", ") || "–"}${mails.length ? ` <span class="ez-sub">(${mails.length} mit E-Mail)</span>` : ""}</td></tr>
    </table>
    <div class="modal-aktionen">
      <button class="btn" id="ics-treffen-btn" type="button">${ikon("download",14)} .ics für den Kalender</button>
      <a class="btn primaer" href="mailto:${mails.map(encodeURIComponent).join(",")}?subject=${betreff}&body=${body}">${ikon("mail",14)} E-Mail-Entwurf öffnen</a>
    </div>
    <p class="hinweis">Reihenfolge: Erst die .ics-Datei herunterladen, dann den E-Mail-Entwurf öffnen und die Datei anhängen – so landet das Treffen bei allen im Kalender, auch ohne die App.</p>`);
  const knopf = document.getElementById("ics-treffen-btn");
  if (knopf) knopf.onclick = () => icsTreffenDatei(t, e);
};

/* ---- Treffen: Terminabstimmung (Doodle-light) ---- */

A.abstimmung = function (evId, treffenId) {
  const t = (S.treffen[evId] || []).find(x => x.id === treffenId);
  if (!t) return;
  t.vorschlaege = t.vorschlaege || [];
  openModal("Terminabstimmung: " + (t.titel || t.typ), `
    ${t.zeit ? `<p class="hinweis" style="margin-bottom:10px">Aktuell fixiert: <b>${esc(t.zeit.replace("T", " "))} Uhr</b> – eine Abstimmung kann den Termin ändern.</p>` : ""}
    ${t.vorschlaege.map(v => {
      const dabei = S.session && (v.stimmen || []).includes(S.session);
      return `
      <div class="reise-zeile">
        <span class="reise-icon">${ikon("uhr",20)}</span>
        <div class="ez-mitte">
          <div class="ez-name">${esc(v.zeit.replace("T", " "))} Uhr</div>
          <div class="ez-sub">${(v.stimmen || []).length} Stimme${(v.stimmen || []).length === 1 ? "" : "n"}: ${(v.stimmen || []).map(id => esc(user(id)?.name || "?")).join(", ") || "–"}</div>
        </div>
        <button class="btn klein ${dabei ? "gewaehlt-ja ja-btn" : ""}" onclick="A.stimme('${evId}','${treffenId}','${v.id}')">${dabei ? "✓ dafür" : "Dafür stimmen"}</button>
        <button class="btn klein primaer" onclick="A.terminFixieren('${evId}','${treffenId}','${v.id}')" title="Diesen Termin übernehmen">Fixieren</button>
      </div>`;
    }).join("") || '<p class="leer">Noch keine Vorschläge – füge unten Zeitoptionen hinzu, das Team stimmt ab.</p>'}
    <form onsubmit="return A.vorschlagHinzu(event,'${evId}','${treffenId}')" style="margin-top:12px">
      <div class="form-reihe" style="align-items:end">
        <label>Neuer Terminvorschlag <input type="datetime-local" name="zeit" required></label>
        <button class="btn primaer" style="height:40px">+ Vorschlag</button>
      </div>
    </form>`);
};

A.vorschlagHinzu = function (evt, evId, treffenId) {
  evt.preventDefault();
  const zeit = new FormData(evt.target).get("zeit");
  const t = (S.treffen[evId] || []).find(x => x.id === treffenId);
  if (t && zeit) {
    t.vorschlaege = t.vorschlaege || [];
    if (!t.vorschlaege.some(v => v.zeit === zeit)) t.vorschlaege.push({ id: uid(), zeit, stimmen: S.session ? [S.session] : [] });
    t.vorschlaege.sort((a, b) => a.zeit.localeCompare(b.zeit));
    save(); render(); A.abstimmung(evId, treffenId);
  }
  return false;
};

A.stimme = function (evId, treffenId, vorschlagId) {
  if (loginNoetig()) return;
  const t = (S.treffen[evId] || []).find(x => x.id === treffenId);
  const v = t?.vorschlaege?.find(x => x.id === vorschlagId);
  if (!v) return;
  v.stimmen = v.stimmen || [];
  const i = v.stimmen.indexOf(S.session);
  if (i >= 0) v.stimmen.splice(i, 1); else v.stimmen.push(S.session);
  save(); render(); A.abstimmung(evId, treffenId);
};

A.terminFixieren = function (evId, treffenId, vorschlagId) {
  const t = (S.treffen[evId] || []).find(x => x.id === treffenId);
  const v = t?.vorschlaege?.find(x => x.id === vorschlagId);
  if (!t || !v) return;
  t.zeit = v.zeit;
  // Sieger-Stimmen als Teilnehmer übernehmen, Abstimmung schließen
  t.teilnehmer = [...new Set([...(t.teilnehmer || []), ...(v.stimmen || [])])];
  t.vorschlaege = [];
  save(); closeModal(); render();
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
    <span class="reise-icon">${ikon("auto",20)}</span>
    <div class="ez-mitte">
      <div class="ez-name">${esc(m.von || "?")} → ${esc(ev(evId)?.ort || "?")}${mitEvent ? ` <a href="#" class="tag" onclick="A.openEvent('${evId}','community');return false">${esc(ev(evId)?.kurz || "?")}</a>` : ""}</div>
      <div class="ez-sub">Fahrer: ${esc(fahrer?.name || "?")}${m.abfahrt ? " · Ab " + esc(m.abfahrt.replace("T", " ")) : ""} · ${frei} von ${m.plaetze} Plätzen frei${m.notiz ? " · " + esc(m.notiz) : ""}</div>
      <div class="chip-reihe klein-chips">${(m.mitfahrer || []).map(user).filter(Boolean).map(u => `<span class="chip"><span class="avatar mini" style="background:${u.farbe}">${esc(u.name[0])}</span>${esc(u.name)}</span>`).join("")}</div>
    </div>
    ${m.fahrerId === S.session ? `<button class="btn klein" onclick="A.mitfahrtFormular('${evId}','${m.id}')">${ikon("stift",14)}</button>` : `<button class="btn klein ${binDrin ? "" : "primaer"}" onclick="A.mitfahrtToggle('${evId}','${m.id}')">${binDrin ? "Aussteigen" : (frei > 0 ? "Mitfahren" : "voll")}</button>`}
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

A.aufgabeFormular = function (evId, aufgabeId) {
  const a = aufgabeId ? listOf(S.aufgaben, evId).find(x => x.id === aufgabeId) : null;
  openModal(a ? "Aufgabe bearbeiten" : "Aufgabe anlegen", `
    <form onsubmit="return A.aufgabeSpeichern(event,'${evId}','${aufgabeId || ""}')">
      <label>Aufgabe <input name="text" required placeholder="z. B. Tisch für 8 Personen reservieren" value="${esc(a?.text || "")}"></label>
      <label>Zuständig <select name="wer"><option value="">– offen –</option>${S.users.map(u => `<option value="${u.id}" ${a?.wer === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
      <div class="modal-aktionen">
        ${a ? `<button type="button" class="btn gefahr" onclick="A.aufgabeLoeschen('${evId}','${a.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.aufgabeSpeichern = function (evt, evId, aufgabeId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { text: f.get("text"), wer: f.get("wer") };
  const arr = listOf(S.aufgaben, evId);
  if (aufgabeId) Object.assign(arr.find(x => x.id === aufgabeId), daten);
  else arr.push({ id: uid(), ...daten, erledigt: false });
  save(); closeModal(); render();
  return false;
};

A.aufgabeErledigt = function (evId, aufgabeId) {
  const a = listOf(S.aufgaben, evId).find(x => x.id === aufgabeId);
  if (a) { a.erledigt = !a.erledigt; save(); render(); }
};

A.aufgabeLoeschen = function (evId, aufgabeId) {
  S.aufgaben[evId] = (S.aufgaben[evId] || []).filter(x => x.id !== aufgabeId);
  save(); closeModal(); render();
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
            <span>${ikon("teilen",13)} Sharing-Runde: <b>${mitglieder.length}</b> angemeldet</span>
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
        <input id="suchfeld" class="suchfeld" style="max-width:none;margin-bottom:12px" placeholder="Bilder und erkannten Folientext durchsuchen …" value="${esc(bildSuche)}" oninput="A.bildSucheSetzen(this.value)">
        <div id="bildergalerie" class="galerie"><p class="leer">Lade…</p></div>
        <p class="hinweis">${ikon("scan",13)} auf einem Bild startet die Texterkennung (OCR) – erkannter Folientext wird gespeichert und ist hier durchsuchbar. Fotos werden beim Hochladen automatisch auf max. 1920 px verkleinert (spart Browserspeicher).</p>
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
        <span class="reise-icon">${ikon("datei",20)}</span>
        <div class="ez-mitte"><div class="ez-name">${esc(d.name)} ${d.ownerId ? (d.geteilt !== false ? `<span class="tag">${ikon("teilen",11)} geteilt</span>` : `<span class="tag">${ikon("schloss",11)} privat</span>`) : ""}</div>
          <div class="ez-sub">${besitzer ? "von " + esc(besitzer.name) + " · " : ""}${esc(d.datum)} · ${(d.blob.size / 1024).toFixed(0)} KB</div></div>
        ${d.mime === "application/pdf" || /\.pdf$/i.test(d.name) ? `<button class="btn klein" onclick="A.folienAnsehen('${d.id}')" title="Folien in der App ansehen">${ikon("buch",14)}</button>` : ""}
        ${meins ? `<button class="btn klein" onclick="A.dateiTeilen('${d.id}')" title="Freigabe umschalten">${d.geteilt !== false ? ikon("schloss",13) : ikon("teilen",13)}</button>` : ""}
        <button class="btn klein" onclick="A.dateiDownload('${d.id}')">${ikon("download",14)}</button>
        ${meins || !d.ownerId ? `<button class="btn klein gefahr" onclick="A.dateiLoeschen('${d.id}')">${ikon("x",13)}</button>` : ""}
      </div>`;
    }).join("") || '<p class="leer">Keine Dateien – Vorträge, Handouts oder eigene Präsentationen hochladen.</p>')
      + (verborgen > 0 ? `<p class="hinweis">${ikon("schloss",12)} ${verborgen} geteilte Datei${verborgen === 1 ? "" : "en"} verborgen – ${ich ? "melde dich oben zur Sharing-Runde an." : "bitte erst per E-Mail anmelden."}</p>` : "");
    const bg = document.getElementById("bildergalerie");
    const q = bildSuche.trim().toLowerCase();
    const bilderGefiltert = q ? bilder.filter(b => (b.name + " " + (b.ocrText || "")).toLowerCase().includes(q)) : bilder;
    if (bg) bg.innerHTML = bilderGefiltert.map(b => {
      const url = URL.createObjectURL(b.blob);
      return `<div class="galerie-bild" title="${esc(b.name)}${b.ocrText ? "\n" + esc(b.ocrText.slice(0, 200)) : ""}">
        <img src="${url}" alt="${esc(b.name)}" onclick="A.bildAnzeigen('${b.id}')">
        <button class="galerie-x" onclick="A.dateiLoeschen('${b.id}')">${ikon("x",13)}</button>
        <button class="galerie-x galerie-ocr ${b.ocrText ? "hat-text" : ""}" onclick="A.bildOcr('${b.id}')" title="${b.ocrText ? "Text erneut erkennen (bereits erkannt)" : "Text erkennen (OCR)"}">${ikon("scan",12)}</button>
      </div>`;
    }).join("") || `<p class="leer">${q ? "Keine Bilder passen zur Suche „" + esc(bildSuche) + "“." : "Keine Bilder – Fotos von Ständen, Slides und Treffen hier sammeln."}</p>`;
  } catch (err) {
    console.error("Materialien laden fehlgeschlagen:", err);
  }
}

// Fotos beim Upload verkleinern (wie Festival-App): spart IndexedDB-Speicher.
// Fällt bei nicht dekodierbaren Formaten (z. B. HEIC) still aufs Original zurück.
async function bildVerkleinern(file, maxKante = 1920, qualitaet = 0.85) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bmp = await createImageBitmap(file);
    const laengste = Math.max(bmp.width, bmp.height);
    if (laengste <= maxKante && file.size < 800 * 1024) { bmp.close && bmp.close(); return file; }
    const faktor = Math.min(1, maxKante / laengste);
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * faktor);
    cv.height = Math.round(bmp.height * faktor);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close && bmp.close();
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", qualitaet));
    if (!blob || blob.size >= file.size) return file; // nur übernehmen, wenn wirklich kleiner
    blob.name = file.name;
    return blob;
  } catch (e) {
    return file;
  }
}

A.dateiHochladen = async function (evId, typ, input) {
  if (typ === "praesentation" && loginNoetig()) { input.value = ""; return; }
  for (const file of input.files) {
    const inhalt = typ === "bild" ? await bildVerkleinern(file) : file;
    await dbPutFile({
      id: uid(), eventId: evId, typ, name: file.name, mime: inhalt.type || file.type, blob: inhalt,
      datum: new Date().toLocaleString("de-DE"),
      originalGroesse: inhalt !== file ? file.size : undefined,
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
      <label style="display:flex;justify-content:space-between;align-items:center">Text
        <button type="button" class="btn klein" id="diktat-btn" onclick="A.diktat()">${ikon("mikro",13)} Diktieren</button>
      </label>
      <textarea name="text" rows="8" required style="margin-top:0">${esc(n?.text || "")}</textarea>
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

/* ---- Tab: Trends & Nuggets (Erkenntnisse, wie Festival-App – hier selbst gepflegt) ---- */

function tErkenntnisse(e) {
  const trends = (S.trends[e.id] || []).slice().sort((a, b) => (b.relevanz || 0) - (a.relevanz || 0));
  const nuggets = S.nuggets[e.id] || [];
  return `
  <div class="spalten">
    <div class="karte">
      <div class="karte-kopf"><h2>${ikon("kompass",16)} Trends (${trends.length})</h2><button class="btn primaer klein" onclick="A.trendFormular('${e.id}')">+ Trend</button></div>
      ${trends.map(t => `
      <div class="trend-zeile" onclick="A.trendFormular('${e.id}','${t.id}')">
        <div class="ez-mitte">
          <div class="ez-name">${esc(t.titel)} <span class="sterne-mini">${"●".repeat(t.relevanz || 0)}${"○".repeat(5 - (t.relevanz || 0))}</span></div>
          ${t.beschreibung ? `<div class="ez-sub">${esc(t.beschreibung)}</div>` : ""}
        </div>
      </div>`).join("") || '<p class="leer">Noch keine Trends – halte nach der Messe fest, welche Entwicklungen dir aufgefallen sind (Relevanz 1–5).</p>'}
    </div>
    <div class="karte">
      <div class="karte-kopf"><h2>${ikon("stern",16)} Nuggets (${nuggets.length})</h2><button class="btn primaer klein" onclick="A.nuggetFormular('${e.id}')">+ Nugget</button></div>
      ${nuggets.map(n => `
      <div class="nugget" onclick="A.nuggetFormular('${e.id}','${n.id}')">
        <div class="nugget-text">„${esc(n.text)}“</div>
        ${n.quelle ? `<div class="ez-sub">— ${esc(n.quelle)}</div>` : ""}
      </div>`).join("") || '<p class="leer">Noch keine Nuggets – die eine Kernaussage, das überraschende Zitat, die Zahl zum Merken.</p>'}
    </div>
  </div>`;
}

A.trendFormular = function (evId, trendId) {
  const t = trendId ? listOf(S.trends, evId).find(x => x.id === trendId) : null;
  openModal(t ? "Trend bearbeiten" : "Trend festhalten", `
    <form onsubmit="return A.trendSpeichern(event,'${evId}','${trendId || ""}')">
      <label>Trend <input name="titel" required placeholder="z. B. Agenten ersetzen Chatbots" value="${esc(t?.titel || "")}"></label>
      <label>Relevanz <select name="relevanz">${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${(t?.relevanz ?? 3) === n ? "selected" : ""}>${"●".repeat(n)}${"○".repeat(5 - n)} (${n}/5)</option>`).join("")}</select></label>
      <label>Einschätzung <textarea name="beschreibung" rows="4" placeholder="Was bedeutet das – und was folgt daraus für dich?">${esc(t?.beschreibung || "")}</textarea></label>
      <div class="modal-aktionen">
        ${t ? `<button type="button" class="btn gefahr" onclick="A.trendLoeschen('${evId}','${t.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.trendSpeichern = function (evt, evId, trendId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { titel: f.get("titel"), relevanz: Number(f.get("relevanz")) || 3, beschreibung: f.get("beschreibung") };
  const arr = listOf(S.trends, evId);
  if (trendId) Object.assign(arr.find(x => x.id === trendId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.trendLoeschen = function (evId, trendId) {
  S.trends[evId] = (S.trends[evId] || []).filter(x => x.id !== trendId);
  save(); closeModal(); render();
};

A.nuggetFormular = function (evId, nuggetId) {
  const n = nuggetId ? listOf(S.nuggets, evId).find(x => x.id === nuggetId) : null;
  openModal(n ? "Nugget bearbeiten" : "Nugget festhalten", `
    <form onsubmit="return A.nuggetSpeichern(event,'${evId}','${nuggetId || ""}')">
      <label>Kernaussage / Zitat <textarea name="text" rows="3" required placeholder="z. B. 80 % der Trainingskosten stecken in der Datenaufbereitung">${esc(n?.text || "")}</textarea></label>
      <label>Quelle <input name="quelle" placeholder="z. B. Keynote Dr. Beispiel, Main Stage" value="${esc(n?.quelle || "")}"></label>
      <div class="modal-aktionen">
        ${n ? `<button type="button" class="btn gefahr" onclick="A.nuggetLoeschen('${evId}','${n.id}')">Löschen</button>` : ""}
        <button type="submit" class="btn primaer">Speichern</button>
      </div>
    </form>`);
};

A.nuggetSpeichern = function (evt, evId, nuggetId) {
  evt.preventDefault();
  const f = new FormData(evt.target);
  const daten = { text: f.get("text"), quelle: f.get("quelle") };
  const arr = listOf(S.nuggets, evId);
  if (nuggetId) Object.assign(arr.find(x => x.id === nuggetId), daten);
  else arr.push({ id: uid(), ...daten });
  save(); closeModal(); render();
  return false;
};

A.nuggetLoeschen = function (evId, nuggetId) {
  S.nuggets[evId] = (S.nuggets[evId] || []).filter(x => x.id !== nuggetId);
  save(); closeModal(); render();
};

/* ---------------- In-App-Foliengalerie (pdf.js, wie Festival-App) ---------------- */

async function pdfjsLaden() {
  if (window.pdfjsLib) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
    s.onload = res;
    s.onerror = () => rej(new Error("pdf.js konnte nicht geladen werden (offline?)"));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

A.folienAnsehen = async function (id) {
  try {
    const d = await dbGetFile(id);
    if (!d) return;
    openModal("Folien: " + d.name, `<p class="hinweis" id="folien-status">Lade PDF-Anzeige …</p><div class="folien-galerie" id="folien-galerie"></div>`);
    await pdfjsLaden();
    const pdf = await pdfjsLib.getDocument({ data: await d.blob.arrayBuffer() }).promise;
    const behaelter = document.getElementById("folien-galerie");
    const maxSeiten = Math.min(pdf.numPages, 40);
    for (let i = 1; i <= maxSeiten && behaelter && behaelter.isConnected; i++) {
      const seite = await pdf.getPage(i);
      const basis = seite.getViewport({ scale: 1 });
      const vp = seite.getViewport({ scale: 960 / basis.width });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height; cv.className = "folie";
      await seite.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      behaelter.appendChild(cv);
      const st = document.getElementById("folien-status");
      if (st) st.textContent = `Seite ${i} von ${pdf.numPages}`;
    }
    const st = document.getElementById("folien-status");
    if (st) st.textContent = `${maxSeiten} von ${pdf.numPages} Seiten` + (pdf.numPages > maxSeiten ? " (Anzeige auf 40 begrenzt – vollständig per ⬇ Download)" : "");
  } catch (e) {
    alert("PDF-Anzeige fehlgeschlagen: " + e.message);
    closeModal();
  }
};

/* ---------------- Diktierfunktion (Web Speech API, wie Festival-App) ---------------- */

let erkennung = null;

A.diktat = function () {
  const ta = document.querySelector(".modal textarea[name=text]");
  const btn = document.getElementById("diktat-btn");
  if (!ta) return;
  if (erkennung) { try { erkennung.stop(); } catch (e) { } return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Spracheingabe wird von diesem Browser nicht unterstützt – bitte Chrome oder Edge verwenden."); return; }
  erkennung = new SR();
  erkennung.lang = "de-DE";
  erkennung.continuous = true;
  erkennung.interimResults = false;
  erkennung.onresult = ev => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) {
        const satz = ev.results[i][0].transcript.trim();
        if (satz) ta.value = (ta.value ? ta.value.replace(/\s+$/, "") + " " : "") + satz;
      }
    }
  };
  erkennung.onend = () => {
    erkennung = null;
    const b = document.getElementById("diktat-btn");
    if (b) { b.innerHTML = ikon("mikro",13) + " Diktieren"; b.classList.remove("aufnahme"); }
  };
  erkennung.onerror = e => {
    if (e.error === "not-allowed") alert("Mikrofon-Zugriff wurde blockiert – bitte in den Browser-Einstellungen erlauben.");
  };
  try {
    erkennung.start();
    btn.innerHTML = ikon("mikro",13) + " Stopp";
    btn.classList.add("aufnahme");
  } catch (e) { erkennung = null; }
};

/* ---------------- OCR für Fotos (Tesseract.js, wie Festival-App) ---------------- */

let bildSuche = "";
let letzteOcr = null; // {evId, name}

A.bildSucheSetzen = function (wert) { bildSuche = wert; sucheFokus = true; render(); };

async function ocrLaden() {
  if (window.Tesseract) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = res;
    s.onerror = () => rej(new Error("Tesseract.js konnte nicht geladen werden (offline?)"));
    document.head.appendChild(s);
  });
}

A.bildOcr = async function (id) {
  try {
    const d = await dbGetFile(id);
    if (!d) return;
    letzteOcr = { evId: d.eventId, name: d.name };
    openModal("Texterkennung: " + d.name, '<p class="hinweis" id="ocr-status">Lade Texterkennung …</p>');
    await ocrLaden();
    const statusEl = () => document.getElementById("ocr-status");
    if (statusEl()) statusEl().textContent = "Erkenne Text … (der erste Lauf lädt Sprachdaten und kann 1–2 Minuten dauern)";
    const url = URL.createObjectURL(d.blob);
    const res = await Tesseract.recognize(url, "deu+eng", {
      logger: m => { const el = statusEl(); if (el && m.status) el.textContent = `${m.status} … ${Math.round((m.progress || 0) * 100)} %`; }
    });
    URL.revokeObjectURL(url);
    const text = (res.data.text || "").trim();
    d.ocrText = text;
    await dbPutFile(d);
    openModal("Erkannter Text: " + d.name, `
      <textarea id="ocr-text" rows="12">${esc(text || "(kein Text erkannt)")}</textarea>
      <p class="hinweis">Der Text ist jetzt am Bild gespeichert – die Bildersuche im Materialien-Tab findet ihn.</p>
      <div class="modal-aktionen">
        <button class="btn" onclick="closeModal()">Schließen</button>
        <button class="btn primaer" onclick="A.ocrAlsNotiz()">Als Notiz speichern</button>
      </div>`);
    nachladenMaterialien();
  } catch (e) {
    alert("OCR fehlgeschlagen: " + e.message);
    closeModal();
  }
};

A.ocrAlsNotiz = function () {
  const text = document.getElementById("ocr-text")?.value?.trim();
  if (!text || !letzteOcr) return;
  listOf(S.notizen, letzteOcr.evId).push({
    id: uid(), titel: "OCR: " + letzteOcr.name, text,
    geaendert: new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  });
  save(); closeModal(); render();
};

/* ---------------- Modal ---------------- */

function openModal(titel, html) {
  const wrap = document.getElementById("modal-wrap");
  wrap.innerHTML = `
    <div class="modal-hintergrund" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-kopf"><h2>${esc(titel)}</h2><button class="btn" onclick="closeModal()">${ikon("x",13)}</button></div>
        <div class="modal-inhalt">${html}</div>
      </div>
    </div>`;
  wrap.style.display = "block";
  const feld = wrap.querySelector("input,textarea,select");
  if (feld) feld.focus();
}
function closeModal() {
  if (erkennung) { try { erkennung.stop(); } catch (e) { } } // laufendes Diktat beenden
  const wrap = document.getElementById("modal-wrap");
  wrap.style.display = "none";
  wrap.innerHTML = "";
}
window.closeModal = closeModal;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------------- Start ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Lucide-Icons in Navigation, Logo und Theme-Leiste einsetzen
  document.querySelectorAll("[data-ico]").forEach(el => {
    el.insertAdjacentHTML("afterbegin", ikon(el.dataset.ico) + (el.classList.contains("navlink") ? " " : ""));
  });
  document.querySelectorAll(".navlink").forEach(el => el.addEventListener("click", () => A.nav(el.dataset.view)));
  A.theme(localStorage.getItem("aimg2026_theme") || "neon");
  render();
  if (typeof CLOUD !== "undefined") CLOUD.init().then(ok => { if (ok) render(); }).catch(e => console.warn("Cloud-Init:", e.message));
});
