// AI Messe Guide 2026 – Seed-Daten
// Hinweis: Termine/Preise sind Startwerte und in der App frei editierbar.
// Jede Veranstaltung kann in der App geändert, gelöscht oder ergänzt werden.
// SEED_VERSION erhöhen, wenn Seed-Termine korrigiert werden – gespeicherte
// Zustände übernehmen die Korrekturen dann einmalig (siehe migriereSeeds in app.js).

const SEED_VERSION = 2; // v2 (06.07.2026): Termine gegen Veranstalter-Websites geprüft

const SEED_EVENTS = [
  {
    id: "ev_dld26", name: "DLD Munich 2026", kurz: "DLD",
    ort: "München", venue: "HVB Forum", land: "DE",
    start: "2026-01-15", end: "2026-01-17",
    kategorie: "Konferenz", preis: 1200,
    url: "https://dld-conference.com",
    beschreibung: "Innovationskonferenz mit starkem KI-Schwerpunkt – Tech, Wissenschaft, Gesellschaft.",
    farbe: "#e879f9", seed: true
  },
  {
    id: "ev_dup26", name: "data:unplugged 2026", kurz: "d:up",
    ort: "Münster", venue: "MCC Halle Münsterland", land: "DE",
    start: "2026-03-25", end: "2026-03-27",
    kategorie: "Konferenz", preis: 450,
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
    kategorie: "Summit", preis: 550,
    url: "https://aidaq.berlin",
    beschreibung: "Bitkom-Summit (früher Big-Data.AI Summit) zu KI, Daten & Quantencomputing – ca. 2.500 Teilnehmer, 200 Speaker.",
    farbe: "#34d399", seed: true
  },
  {
    id: "ev_ndf26", name: "Nürnberg Digital Festival", kurz: "NUEdigital",
    ort: "Nürnberg", venue: "verteilt (ganze Stadt)", land: "DE",
    start: "2026-06-22", end: "2026-07-02",
    kategorie: "Festival", preis: 0,
    url: "https://nuernberg.digital",
    beschreibung: "Dezentrales Digitalfestival mit vielen KI-Sessions – Großteil kostenlos.",
    farbe: "#fbbf24", seed: true
  },
  {
    id: "ev_wad26", name: "WeAreDevelopers World Congress", kurz: "WAD",
    ort: "Berlin", venue: "CityCube Berlin", land: "DE",
    start: "2026-07-08", end: "2026-07-10",
    kategorie: "Kongress", preis: 699,
    url: "https://www.wearedevelopers.com/world-congress",
    beschreibung: "Größter Entwicklerkongress Europas – 241 Sessions, 270 Speaker, starker AI-Track.",
    farbe: "#60a5fa", seed: true
  },
  {
    id: "ev_1e9_26", name: "1E9 – Festival der Zukunft", kurz: "1E9",
    ort: "München", venue: "Deutsches Museum", land: "DE",
    start: "2026-07-02", end: "2026-07-05",
    kategorie: "Festival", preis: 349,
    url: "https://1e9.community",
    beschreibung: "Zukunftsfestival von 1E9 – KI, Robotik, NewSpace, Kunst & Technologie im Deutschen Museum.",
    farbe: "#a78bfa", seed: true
  },
  {
    id: "ev_ipai26", name: "AI Festival Heilbronn (IPAI)", kurz: "IPAI",
    ort: "Heilbronn", venue: "Zukunftspark Wohlgelegen", land: "DE",
    start: "2026-07-25", end: "2026-07-26",
    kategorie: "Festival", preis: 290,
    url: "https://ip.ai",
    beschreibung: "Festival des Innovation Park Artificial Intelligence – angewandte KI, Start-ups, Forschung.",
    farbe: "#fb923c", seed: true
  },
  {
    id: "ev_bp26", name: "Bits & Pretzels 2026", kurz: "B&P",
    ort: "München", venue: "ICM München", land: "DE",
    start: "2026-09-28", end: "2026-09-30",
    kategorie: "Konferenz", preis: 599,
    url: "https://www.bitsandpretzels.com",
    beschreibung: "Founders-Festival zur Wiesn-Zeit – 2026 mit eigenem AI-Stage-Programm.",
    farbe: "#4ade80", seed: true
  },
  {
    id: "ev_bdaiw26", name: "Big Data & AI World Frankfurt", kurz: "BDAIW",
    ort: "Frankfurt am Main", venue: "Messe Frankfurt, Halle 3", land: "DE",
    start: "2026-05-06", end: "2026-05-07",
    kategorie: "Messe", preis: 0,
    url: "https://www.bigdataworldfrankfurt.de",
    beschreibung: "Fachmesse für Big Data & KI im Rahmen der TechShow Frankfurt – Ausstellung kostenlos.",
    farbe: "#f87171", seed: true
  }
];

const KOSTEN_KATEGORIEN = ["Eintritt", "Fahrtkosten", "Übernachtung", "Verpflegung", "Sonstiges"];
const VERKEHRSMITTEL = ["Pkw", "Bahn", "Flug", "ÖPNV", "Fernbus", "Mitfahrgelegenheit", "Fahrrad", "Sonstiges"];
const VM_ICON = { "Pkw": "🚗", "Bahn": "🚆", "Flug": "✈️", "ÖPNV": "🚇", "Fernbus": "🚌", "Mitfahrgelegenheit": "🚘", "Fahrrad": "🚲", "Sonstiges": "🧭" };
const TREFFEN_TYPEN = ["Mittagessen", "Vor der Konferenz", "Während der Konferenz", "Nachbetrachtung", "Abendessen", "Sonstiges"];
const ZAHLUNGSARTEN = ["Kreditkarte", "PayPal", "Rechnung", "Überweisung", "Firmenkonto", "Bar"];
const ANMELDE_STATUS = ["Interessiert", "Angemeldet", "Bezahlt", "Besucht", "Abgesagt"];
