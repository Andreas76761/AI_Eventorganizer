// AI Messe Guide 2026 – Seed-Daten
// Hinweis: Termine/Preise sind Startwerte und in der App frei editierbar.
// Jede Veranstaltung kann in der App geändert, gelöscht oder ergänzt werden.
// SEED_VERSION erhöhen, wenn Seed-Termine korrigiert werden – gespeicherte
// Zustände übernehmen die Korrekturen dann einmalig (siehe migriereSeeds in app.js).

const SEED_VERSION = 8; // v8 (26.11.2026): 7 weitere Events 2027 (OMR, re:publica, KI-X, AI:CAN, DIKITALE, Accelerate Tomorrow, AI Week FFM)

const SEED_EVENTS = [
  {
    id: "ev_dld26", name: "DLD Munich 2026", kurz: "DLD",
    ort: "München", venue: "HVB Forum", land: "DE",
    start: "2026-01-15", end: "2026-01-17",
    kategorie: "Konferenz", preis: 0,
    preise: [{ typ: "Nur auf Einladung (invite-only)", betrag: 0, hinweis: "kein freier Ticketverkauf" }],
    url: "https://dld-conference.com",
    beschreibung: "Innovationskonferenz mit starkem KI-Schwerpunkt – Tech, Wissenschaft, Gesellschaft.",
    farbe: "#e879f9", seed: true
  },
  {
    id: "ev_dup26", name: "data:unplugged 2026", kurz: "d:up",
    ort: "Münster", venue: "MCC Halle Münsterland", land: "DE",
    start: "2026-03-26", end: "2026-03-27",
    kategorie: "Konferenz", preis: 389,
    preise: [
      { typ: "Festival-Pass Early Bird", betrag: 389 },
      { typ: "Festival-Pass regulär (historischer Startwert)", betrag: 589, hinweis: "nicht bestätigt; nicht als aktuelles Angebot verwenden" }
    ],
    url: "https://www.data-unplugged.de",
    beschreibung: "Data- & AI-Konferenz mit Festival-Charakter – Data Engineering, GenAI, MLOps.",
    farbe: "#22d3ee", seed: true
  },
  {
    id: "ev_roai26", name: "Rise of AI Conference", kurz: "RoAI",
    ort: "Berlin", venue: "Berlin & Virtual", land: "DE",
    start: "2026-05-05", end: "2026-05-06",
    kategorie: "Konferenz", preis: 790,
    url: "https://riseof.ai",
    beschreibung: "Eine der ältesten deutschen KI-Konferenzen – Strategie, Forschung, Anwendung.",
    farbe: "#f472b6", seed: true
  },
  {
    id: "ev_bdai26", name: "AIDAQ – AI, Data & Quantum Summit (Bitkom)", kurz: "AIDAQ",
    ort: "Berlin", venue: "bcc Berlin, Alexanderstr. 11", land: "DE",
    start: "2026-09-22", end: "2026-09-23",
    kategorie: "Summit", preis: 600,
    preise: [
      { typ: "Early Bird (bis 01.06.)", betrag: 600 },
      { typ: "Standard", betrag: 700 }
    ],
    url: "https://aidaq.berlin",
    beschreibung: "Bitkom-Summit (früher Big-Data.AI Summit) zu KI, Daten & Quantencomputing – ca. 2.500 Teilnehmer, 200 Speaker.",
    farbe: "#34d399", seed: true
  },
  {
    id: "ev_ndf26", name: "Nürnberg Digital Festival", kurz: "NUEdigital",
    ort: "Nürnberg", venue: "verteilt (ganze Stadt)", land: "DE",
    start: "2026-06-22", end: "2026-07-02",
    kategorie: "Festival", preis: 0,
    preise: [{ typ: "Großteil der Sessions", betrag: 0, hinweis: "einzelne Formate kostenpflichtig" }],
    url: "https://nuernberg.digital",
    beschreibung: "Dezentrales Digitalfestival mit vielen KI-Sessions – Großteil kostenlos.",
    farbe: "#fbbf24", seed: true
  },
  {
    id: "ev_wad26", name: "WeAreDevelopers World Congress", kurz: "WAD",
    ort: "Berlin", venue: "CityCube Berlin", land: "DE",
    start: "2026-07-08", end: "2026-07-10",
    kategorie: "Kongress", preis: 299,
    preise: [
      { typ: "Congress Pass (Super Early Bird)", betrag: 299, hinweis: "regulär 799 €" },
      { typ: "Congress Pass Plus", betrag: 599, hinweis: "regulär 1.199 €" },
      { typ: "VIP Pass", betrag: 1000, hinweis: "regulär 2.499 €" },
      { typ: "Startup Pass", betrag: 299 },
      { typ: "Studierende", betrag: 120 }
    ],
    url: "https://www.wearedevelopers.com/world-congress",
    beschreibung: "Größter Entwicklerkongress Europas – 241 Sessions, 270 Speaker, starker AI-Track.",
    farbe: "#60a5fa", seed: true
  },
  {
    id: "ev_1e9_26", name: "1E9 – Festival der Zukunft", kurz: "1E9",
    ort: "München", venue: "Deutsches Museum", land: "DE",
    start: "2026-07-02", end: "2026-07-05",
    kategorie: "Festival", preis: 159,
    preise: [
      { typ: "Regulär", betrag: 159 },
      { typ: "1E9-Mitglieder", betrag: 127, hinweis: "20 % Rabatt" }
    ],
    url: "https://1e9.community",
    beschreibung: "Zukunftsfestival von 1E9 – KI, Robotik, NewSpace, Kunst & Technologie im Deutschen Museum.",
    farbe: "#a78bfa", seed: true
  },
  {
    id: "ev_ipai26", name: "AI Festival Heilbronn (IPAI)", kurz: "IPAI",
    ort: "Heilbronn", venue: "Zukunftspark Wohlgelegen", land: "DE",
    start: "2026-07-25", end: "2026-07-26",
    kategorie: "Festival", preis: 0,
    preise: [{ typ: "Festivalbesuch", betrag: 0, hinweis: "laut Veranstalter ohne Voranmeldung" }],
    preisStatus: "bestätigt", datenStand: "2026-10-07",
    quelleUrl: "https://ipai-foundation.ai/heilbronn-wird-zum-zentrum-der-europaeischen-ki-kultur-das-5-ki-festival-der-ipai-foundation-setzt-neue-massstaebe/",
    url: "https://ipai-foundation.ai",
    beschreibung: "Festival des Innovation Park Artificial Intelligence – angewandte KI, Start-ups, Forschung.",
    farbe: "#fb923c", seed: true
  },
  {
    id: "ev_bp26", name: "Bits & Pretzels 2026", kurz: "B&P",
    ort: "München", venue: "ICM München", land: "DE",
    start: "2026-09-28", end: "2026-09-30",
    kategorie: "Konferenz", preis: 399,
    preise: [
      { typ: "Startup (1–10 MA)", betrag: 399 },
      { typ: "Scaleup (11–300 MA)", betrag: 499 },
      { typ: "Studierende (Partnerprogramm)", betrag: 199 }
    ],
    url: "https://www.bitsandpretzels.com",
    beschreibung: "Founders-Festival zur Wiesn-Zeit – 2026 mit eigenem AI-Stage-Programm.",
    farbe: "#4ade80", seed: true
  },
  {
    id: "ev_bdaiw26", name: "Big Data & AI World Frankfurt", kurz: "BDAIW",
    ort: "Frankfurt am Main", venue: "Messe Frankfurt, Halle 3", land: "DE",
    start: "2026-05-06", end: "2026-05-07",
    kategorie: "Messe", preis: 0,
    preise: [{ typ: "Messebesuch", betrag: 0, hinweis: "kostenlos nach Registrierung" }],
    url: "https://www.bigdataworldfrankfurt.de",
    beschreibung: "Fachmesse für Big Data & KI im Rahmen der TechShow Frankfurt – Ausstellung kostenlos.",
    farbe: "#f87171", seed: true
  }
];

SEED_EVENTS.forEach(e => {
  if (e.preis > 0) e.preisStatus = "historisch-unbestätigt";
});
SEED_EVENTS.push({
  id: "ev_kixhr26", name: "KI-X HR Convention 2026", kurz: "KI-X HR",
  ort: "Berlin", venue: "Veranstaltungsort beim Veranstalter prüfen", land: "DE",
  start: "2026-11-18", end: "2026-11-19", kategorie: "Konferenz",
  preis: null, preisStatus: "offen", datenStand: "2026-10-07",
  preise: [{ typ: "Ticket", betrag: null, hinweis: "Preis noch zu prüfen" }],
  url: "https://hr.ki-x.berlin/", quelleUrl: "https://hr.ki-x.berlin/",
  beschreibung: "KI im Recruiting, HR-Services, Lernen und Workforce Planning; Praxisbeispiele, Governance und verantwortungsvoller Einsatz.",
  farbe: "#38bdf8", seed: true
});

const NEUE_TERMINE = [
  { id: "ev_mlcon26", name: "MLcon Berlin 2026", kurz: "MLcon", ort: "Berlin", venue: "Berlin oder online", start: "2026-11-16", end: "2026-11-20", kategorie: "Konferenz", preis: null, url: "https://mlconference.ai/berlin/program-berlin/", beschreibung: "Machine Learning, KI-Agenten, RAG und MLOps. Konferenz, Bootcamps und Workshops; Umfang abhängig vom Ticket." },
  { id: "ev_hpi26", name: "AI@HPI Conference 2026", kurz: "AI@HPI", ort: "Potsdam", venue: "Hasso-Plattner-Institut", start: "2026-12-02", end: "2026-12-03", kategorie: "Konferenz", preis: 290, url: "https://hpi.de/en/ai-hpi-conference/", beschreibung: "KI und Wertschöpfung, industrielle Systeme und Mensch-KI-Zusammenarbeit.", preise: [{ typ: "Konferenzticket (beide Tage)", betrag: 290, hinweis: "Veranstalterpreis; steuerliche Behandlung vor Buchung prüfen" }] },
  { id: "ev_dup27", name: "data:unplugged 2027", kurz: "d:up", ort: "Münster", venue: "Genauen Veranstaltungsort vor Buchung prüfen", start: "2027-04-13", end: "2027-04-14", kategorie: "Festival", preis: null, url: "https://www.data-unplugged.de/en/festival/du27", beschreibung: "Data- und KI-Festival: Wirtschaft, Technologie und Austausch." },
  { id: "ev_1e9_27", name: "1E9 – Festival der Zukunft 2027", kurz: "1E9", ort: "München", venue: "Deutsches Museum", start: "2027-07-01", end: "2027-07-04", kategorie: "Festival", preis: null, url: "https://festivalderzukunft.com/", beschreibung: "KI, Forschung, Start-ups, Kunst und Zukunftstechnologien. Early Bird angekündigt ab 1. November; 20 % Mitgliederrabatt. Ticketbetrag noch offen." }
].map(e => ({ ...e, land: "DE", farbe: "#38bdf8", seed: true, eingefuehrtVersion: 5, datenStand: "2026-10-07", quelleUrl: e.url, terminStatus: "bestätigt", preisStatus: e.preis == null ? "offen" : "bestätigt" }));
SEED_EVENTS.push(...NEUE_TERMINE);

// v6 (Recherche 21.11.2026): 2027er-Ausgaben der übrigen wiederkehrenden Events.
// terminStatus "unbestätigt" = vom Veranstalter noch nicht angekündigt, Termin geschätzt.
const NEUE_TERMINE_V6 = [
  { id: "ev_dld27", name: "DLD Munich 2027", kurz: "DLD", ort: "München", venue: "wird angekündigt", start: "2027-01-14", end: "2027-01-16", kategorie: "Konferenz", preis: 0, terminStatus: "unbestätigt", farbe: "#e879f9", url: "https://dld-conference.com", preise: [{ typ: "Nur auf Einladung (invite-only)", betrag: 0, hinweis: "kein freier Ticketverkauf" }], beschreibung: "Innovationskonferenz mit KI-Schwerpunkt. Termin geschätzt (Mitte Januar, Muster der Vorjahre)." },
  { id: "ev_roai27", name: "Rise of AI Conference 2027", kurz: "RoAI", ort: "Berlin", venue: "Berlin & Virtual", start: "2027-05-12", end: "2027-05-12", kategorie: "Konferenz", preis: null, farbe: "#f472b6", url: "https://riseof.ai/conference-2027/", beschreibung: "Eine der ältesten deutschen KI-Konferenzen. Termin vom Veranstalter angekündigt; Ticketpreis noch offen (2026: 790 €)." },
  { id: "ev_bdaiw27", name: "Big Data & AI World Frankfurt 2027", kurz: "BDAIW", ort: "Frankfurt am Main", venue: "Messe Frankfurt, Halle 3", start: "2027-05-19", end: "2027-05-20", kategorie: "Messe", preis: 0, farbe: "#f87171", url: "https://www.techshowfrankfurt.de/big-data-ai-world", preise: [{ typ: "Messebesuch", betrag: 0, hinweis: "kostenlos nach Registrierung (wie Vorjahre)" }], beschreibung: "Fachmesse für Big Data & KI im Rahmen der TechShow Frankfurt." },
  { id: "ev_ndf27", name: "Nürnberg Digital Festival 2027", kurz: "NUEdigital", ort: "Nürnberg", venue: "verteilt (ganze Stadt)", start: "2027-06-14", end: "2027-06-24", kategorie: "Festival", preis: 0, farbe: "#fbbf24", url: "https://nuernberg.digital", preise: [{ typ: "Großteil der Sessions", betrag: 0, hinweis: "einzelne Formate kostenpflichtig" }], beschreibung: "Dezentrales Digitalfestival mit vielen KI-Sessions – Termin von IHK und Veranstalter bestätigt." },
  { id: "ev_wad27", name: "WeAreDevelopers World Congress 2027", kurz: "WAD", ort: "Berlin", venue: "Messe Berlin (Südeingang & CityCube)", start: "2027-07-14", end: "2027-07-16", kategorie: "Kongress", preis: 299, farbe: "#60a5fa", url: "https://www.wearedevelopers.com/world-congress", preise: [
      { typ: "Congress Pass (Super Early Bird)", betrag: 299, hinweis: "regulär 799 €" },
      { typ: "Congress Pass Plus", betrag: 599, hinweis: "regulär 1.199 €" },
      { typ: "VIP Pass", betrag: 1000, hinweis: "regulär 2.499 €" },
      { typ: "Startup Pass", betrag: 299 },
      { typ: "Studierende", betrag: 120 }
    ], beschreibung: "Größter Entwicklerkongress Europas mit starkem AI-Track – Vorverkauf läuft bereits." },
  { id: "ev_aidaq27", name: "AIDAQ – AI, Data & Quantum Summit 2027", kurz: "AIDAQ", ort: "Berlin", venue: "wird angekündigt", start: "2027-09-21", end: "2027-09-22", kategorie: "Summit", preis: null, terminStatus: "unbestätigt", farbe: "#34d399", url: "https://aidaq.berlin", beschreibung: "Bitkom-Summit zu KI, Daten & Quantencomputing. Termin geschätzt (Ende September, Muster 2026); 2026: 600–700 €." },
  { id: "ev_bp27", name: "Bits & Pretzels 2027", kurz: "B&P", ort: "München", venue: "Messegelände + Oktoberfest", start: "2027-09-27", end: "2027-09-29", kategorie: "Konferenz", preis: 270, preisStatus: "bestätigt", datenStand: "2026-11-26", farbe: "#4ade80", url: "https://www.bitsandpretzels.com", preise: [
    { typ: "Startup Basic", betrag: 270, hinweis: "Frühbucher-/#bits26-Konditionen möglich" },
    { typ: "Startup 3-Tage", betrag: 520 },
    { typ: "Ecosystem", betrag: 670, hinweis: "je Kategorie bis 820 €" },
    { typ: "Investor", betrag: 938, hinweis: "bis 1.820 €" }
  ], beschreibung: "Founders-Festival zur Wiesn-Zeit. Ticketshop offen (geprüft 26.11.2026); Preise je nach Teilnehmerkategorie." }
].map(e => ({ ...e, land: "DE", farbe: e.farbe || "#38bdf8", seed: true, eingefuehrtVersion: 6, datenStand: "2026-11-21", quelleUrl: e.url, terminStatus: e.terminStatus || "bestätigt", preisStatus: e.preis == null ? "offen" : "bestätigt" }));
SEED_EVENTS.push(...NEUE_TERMINE_V6);

// v8 (Recherche 26.11.2026): weitere KI-/Digital-Events 2027.
// Quellen: Veranstalter (OMR, AI Week FFM), visitBerlin (Accelerate Tomorrow),
// CAMPIXX-Eventkalender (re:publica, KI-X, AI:CAN, DIKITALE) – vor Buchung beim Veranstalter prüfen.
const NEUE_TERMINE_V8 = [
  { id: "ev_omr27", name: "OMR Festival 2027", kurz: "OMR", ort: "Hamburg", venue: "Hamburg Messe", start: "2027-05-03", end: "2027-05-05", kategorie: "Festival", preis: null, farbe: "#f59e0b", url: "https://omr.com/festival/", beschreibung: "Digital- & Marketing-Festival mit großem KI-Programm (Tag 1: Masterclasses & Side Events, danach Hauptprogramm). Termin vom Veranstalter bestätigt; Tickets noch offen." },
  { id: "ev_republica27", name: "re:publica 2027", kurz: "re:publica", ort: "Berlin", venue: "wird angekündigt", start: "2027-05-10", end: "2027-05-12", kategorie: "Festival", preis: null, terminStatus: "unbestätigt", farbe: "#ef4444", url: "https://re-publica.com", quelleUrl: "https://www.campixx.de/events/ai-ki/", beschreibung: "Gesellschafts- & Digitalfestival mit starkem KI-Schwerpunkt. Termin laut Eventkalender, vom Veranstalter noch nicht bestätigt." },
  { id: "ev_kix27", name: "KI-X Konferenz 2027", kurz: "KI-X", ort: "Berlin", venue: "wird angekündigt", start: "2027-03-02", end: "2027-03-03", kategorie: "Konferenz", preis: null, farbe: "#38bdf8", url: "https://ki-x.berlin/", quelleUrl: "https://www.campixx.de/events/ai-ki/", beschreibung: "KI-Konferenz für Verwaltung und Wirtschaft (Hauptausgabe; die HR-Ausgabe ist separat erfasst). Termin laut Eventkalender." },
  { id: "ev_aican27", name: "AI:CAN 2027", kurz: "AI:CAN", ort: "Berlin", venue: "wird angekündigt (Vortag der CAMPIXX)", start: "2027-06-02", end: "2027-06-02", kategorie: "Konferenz", preis: 399, farbe: "#c084fc", url: "https://www.campixx.de/events/ai-ki/", beschreibung: "Eintägige KI-Anwenderkonferenz der CAMPIXX-Familie – ab 399 €. Veranstalter-Website vor Buchung prüfen." },
  { id: "ev_dikitale27", name: "DIKITALE 2027", kurz: "DIKITALE", ort: "Düsseldorf", venue: "wird angekündigt", start: "2027-06-16", end: "2027-06-17", kategorie: "Konferenz", preis: 149, farbe: "#2dd4bf", url: "https://www.campixx.de/events/ai-ki/", beschreibung: "Digital- & KI-Konferenz in Düsseldorf – Tickets laut Eventkalender 149–499 €. Veranstalter-Website vor Buchung prüfen.", preise: [{ typ: "Ticket (Spanne lt. Eventkalender)", betrag: 149, hinweis: "bis 499 € je nach Kategorie" }] },
  { id: "ev_acctom27", name: "Accelerate Tomorrow AI Summit 2027", kurz: "AccTom", ort: "Berlin", venue: "wird angekündigt", start: "2027-07-15", end: "2027-07-16", kategorie: "Summit", preis: null, farbe: "#818cf8", url: "https://www.visitberlin.de/en/event/accelerate-tomorrow-ai-summit-2027", beschreibung: "Zweitägiger AI-Summit in Berlin. Termin über visitBerlin gelistet; Tickets noch offen." },
  { id: "ev_aiw27", name: "AI Week Frankfurt 2027", kurz: "AIW", ort: "Frankfurt am Main", venue: "The Squaire (wie 2026, unbestätigt)", start: "2027-10-25", end: "2027-10-29", kategorie: "Festival", preis: null, terminStatus: "unbestätigt", farbe: "#fb7185", url: "https://ai-week-frankfurt.com", beschreibung: "KI-Eventwoche am Frankfurter Flughafen – 2026er-Programm & Transkripte sind im Archiv der App. Termin geschätzt (Ende Oktober, Muster 2026)." }
].map(e => ({ ...e, land: "DE", seed: true, eingefuehrtVersion: 8, datenStand: "2026-11-26", quelleUrl: e.quelleUrl || e.url, terminStatus: e.terminStatus || "bestätigt", preisStatus: e.preis == null ? "offen" : "bestätigt" }));
SEED_EVENTS.push(...NEUE_TERMINE_V8);

const KOSTEN_KATEGORIEN = ["Eintritt", "Fahrtkosten", "Übernachtung", "Verpflegung", "Sonstiges"];
const VERKEHRSMITTEL = ["Pkw", "Bahn", "Flug", "ÖPNV", "Fernbus", "Mitfahrgelegenheit", "Fahrrad", "Sonstiges"];
const VM_ICON = { "Pkw": "🚗", "Bahn": "🚆", "Flug": "✈️", "ÖPNV": "🚇", "Fernbus": "🚌", "Mitfahrgelegenheit": "🚘", "Fahrrad": "🚲", "Sonstiges": "🧭" };
const TREFFEN_TYPEN = ["Mittagessen", "Vor der Konferenz", "Während der Konferenz", "Nachbetrachtung", "Abendessen", "Sonstiges"];
const ZAHLUNGSARTEN = ["Kreditkarte", "PayPal", "Rechnung", "Überweisung", "Firmenkonto", "Bar"];
const ANMELDE_STATUS = ["Interessiert", "Angemeldet", "Bezahlt", "Besucht", "Abgesagt"];

// Währungen mit Richtkursen in EUR (editierbar im Formular; Live-Kurs wird,
// falls online, von frankfurter.app nachgeladen – EZB-Referenzkurse).
const WAEHRUNGEN = {
  EUR: 1, USD: 0.86, GBP: 1.17, CHF: 1.06, JPY: 0.0058,
  SEK: 0.089, DKK: 0.134, PLN: 0.235, CZK: 0.041
};
const UST_SAETZE = [19, 7, 0];

// Event-Archive: Programm, Transkripte, Speaker, Aussteller – nach Jahren getrennt (recherchiert 26.11.2026)
const ARCHIV_QUELLEN = [
  { id: "aiw", url: "data/aiw-archiv.json", name: "AI Week Frankfurt – Archiv", zeitraum: "2024 · 2025 · 2026", info: "Programm mit Transkript-Links (124 Talks 2026), 178 Speaker, 22 Aussteller mit Ständen, Workshops, Fotos & Recaps" },
  { id: "wad", url: "data/wad-archiv.json", name: "WeAreDevelopers World Congress – Archiv", zeitraum: "2024 · 2025 · 2026", info: "241 Sessions und 270 Speaker (2026) aus der Agenda, Keynotes, After-Movies & Recaps der Vorjahre", eventIds: { 2026: "ev_wad26" } },
  { id: "e9", url: "data/e9-archiv.json", name: "1E9 – Festival der Zukunft – Archiv", zeitraum: "2025 · 2026", info: "284 Programmpunkte mit Inhaltsbeschreibung, 313 Speaker mit Bio und 254 Firmen (2026); Motto, Speaker & Quellen 2025", eventIds: { 2026: "ev_1e9_26" } },
  { id: "dup", url: "data/dup-archiv.json", name: "data:unplugged – Archiv", zeitraum: "2025 · 2026", info: "2026: 10.000+ Teilnehmende, 200+ Speaker (u. a. Hoeneß, Lanz, DeepL), 150+ Aussteller; 2025 im Skaters Palace", eventIds: { 2026: "ev_dup26" } },
  { id: "roai", url: "data/roai-archiv.json", name: "Rise of AI Conference – Archiv", zeitraum: "2025 · 2026", info: "10. Ausgabe 2026 im Humboldt Carré (Meta + Applied AI Stage); 2025 „Good news from Europe“ mit Wissing", eventIds: { 2026: "ev_roai26" } },
  { id: "bdaiw", url: "data/bdaiw-archiv.json", name: "Big Data & AI World Frankfurt – Archiv", zeitraum: "2025 · 2026", info: "Tech Show Frankfurt: 150+ Sessions auf 7 Bühnen, BARC-Keynotes, Speaker-Verzeichnis; 2025 mit 7.000+ Besuchern", eventIds: { 2026: "ev_bdaiw26" } },
  { id: "aidaq", url: "data/aidaq-archiv.json", name: "AIDAQ (Bitkom) – Archiv", zeitraum: "2025 · 2026", info: "2026: 2.500+ Teilnehmer, 220 Speaker, 140 Sessions, Keynote Dorothee Bär, Schirmherrschaft BMFTR", eventIds: { 2026: "ev_bdai26" } },
  { id: "bp", url: "data/bp-archiv.json", name: "Bits & Pretzels – Archiv", zeitraum: "2025 · 2026", info: "2026 „Human after all“ mit Trevor Noah & Steven Bartlett; 2025 „Connecting Europe“ mit 21.000 Investorengesprächen", eventIds: { 2026: "ev_bp26" } },
  { id: "dld", url: "data/dld-archiv.json", name: "DLD Munich – Archiv", zeitraum: "2025 · 2026", info: "2026: 200+ Speaker (Whittaker, Russell, Vestager …), alle Talks als Video; 2025: 20-Jahre-Jubiläum", eventIds: { 2026: "ev_dld26" } },
  { id: "nue", url: "data/nue-archiv.json", name: "NUEdigital – Archiv", zeitraum: "2025 · 2026", info: "2026 „Recode the Future“: 240+ Events von 260 Partnern inkl. Bayerischer Digitalgipfel; dezentral in Nürnberg & Region", eventIds: { 2026: "ev_ndf26" } },
  { id: "ipai", url: "data/ipai-archiv.json", name: "KI Festival Heilbronn (IPAI) – Archiv", zeitraum: "2025 · 2026", info: "5. Ausgabe 2026: 50+ Speaker, 20+ Workshops, Eintritt frei, bis 13.500 Besucher; 2025 mit 10.000+", eventIds: { 2026: "ev_ipai26" } },
  { id: "mlcon", url: "data/mlcon-archiv.json", name: "MLcon – Archiv", zeitraum: "2025 · 2026", info: "GenAI- & ML-Konferenz (Berlin Nov. + München Juni): Bootcamps, Workshops, RAG/MLOps/Agenten", eventIds: { 2026: "ev_mlcon26" } },
  { id: "hpi", url: "data/hpi-archiv.json", name: "AI@HPI Conference – Archiv", zeitraum: "2025 · 2026", info: "2026 (2.–3.12., Potsdam): Keynote Scheiter, Panel mit BMFTR; 2025 „Shaping AI Sovereignty“ mit allen Videos", eventIds: { 2026: "ev_hpi26" } },
  { id: "kix", url: "data/kix-archiv.json", name: "KI-X HR Convention – Archiv", zeitraum: "2025 · 2026", info: "KI für HR im Colosseum Berlin: Keynotes, Hands-on-Workshops, Ethik-Schwerpunkt", eventIds: { 2026: "ev_kixhr26" } }
];
