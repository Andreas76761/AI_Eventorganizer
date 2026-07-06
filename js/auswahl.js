// Auswahlliste: AI-Veranstaltungen 2025/2026 in Deutschland.
// Quellen: Web-Recherche (Juli 2026) + eigener Google-Kalender
// (inkl. abonnierte Kalender "KI-Café – KOERTING INSTITUTE" und "AI xpress").
// kosten = typischer Ticketpreis (Startwert, in der Liste editierbar).
// eventId = Verknüpfung zu einer bereits in der App angelegten Veranstaltung.

const AUSWAHL_KANDIDATEN = [
  // ---------- 2025 (Rückblick / Dokumentation) ----------
  { id: "k_sks25", name: "#05 Stuttgarter KI Summit", start: "2025-01-30", end: "2025-01-30", ort: "Stuttgart", venue: "mdct AG, Tübinger Str. 63–65", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_aiact25", name: "Podiumsdiskussion zum EU AI Act", start: "2025-01-29", end: "2025-01-29", ort: "Darmstadt", venue: "Hilpertstraße 31", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_yai25", name: "The Year in AI: 2024 Recap & 2025 Outlook", start: "2025-01-29", end: "2025-01-29", ort: "Hamburg", venue: "W3 – Werkstatt f. int. Kultur", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_du25", name: "data:unplugged 2025", start: "2025-02-26", end: "2025-02-27", ort: "Münster", venue: "Skaters Palace", kosten: 450, quelle: "Recherche", url: "https://www.data-unplugged.de" },
  { id: "k_scd25", name: "Smart City Days Pforzheim 2025", start: "2025-03-12", end: "2025-03-12", ort: "Pforzheim", venue: "", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_hm25", name: "Hannover Messe 2025 (Schwerpunkt KI & Robotik)", start: "2025-03-31", end: "2025-04-04", ort: "Hannover", venue: "Messegelände", kosten: 60, quelle: "Recherche", url: "https://www.hannovermesse.de" },
  { id: "k_roai25", name: "Rise of AI Conference 2025", start: "2025-05-14", end: "2025-05-14", ort: "Berlin", venue: "", kosten: 790, quelle: "Recherche", url: "https://riseof.ai" },
  { id: "k_wad25", name: "WeAreDevelopers World Congress 2025", start: "2025-07-09", end: "2025-07-11", ort: "Berlin", venue: "CityCube", kosten: 699, quelle: "Recherche", url: "https://www.wearedevelopers.com/world-congress" },
  { id: "k_ki25", name: "KI2025 – 48. Deutsche KI-Konferenz", start: "2025-09-16", end: "2025-09-19", ort: "Potsdam", venue: "", kosten: 450, quelle: "Recherche", url: "https://www.it-schulungen.com/seminare/events-messen-workshops/messen-konferenzen-und-kongresse/ki2025.html" },

  // ---------- 2026 ----------
  { id: "k_kss26", name: "KI Summit Stuttgart: Enterprise Automation & GenAI", start: "2026-01-28", end: "2026-01-28", ort: "Stuttgart", venue: "SprintEins, Rotebühlstraße 87E", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_symp26", name: "KI Symposium Mainz", start: "2026-03-05", end: "2026-03-05", ort: "Mainz", venue: "Ludwigsstraße 2", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_aixp26", name: "AI xpress ACCELERATOR – Final Pitch & Startup Expo", start: "2026-03-12", end: "2026-03-12", ort: "Böblingen", venue: "AI xpress, Röhrer Weg 8", kosten: 0, quelle: "Google-Kalender", url: "" },
  { id: "k_transform26", name: "TRANSFORM 2026", start: "2026-03-18", end: "2026-03-19", ort: "Berlin", venue: "", kosten: 590, quelle: "Recherche", url: "https://www.omt.de/events/ki-events/" },
  { id: "k_du26", name: "data:unplugged 2026", start: "2026-03-25", end: "2026-03-27", ort: "Münster", venue: "MCC Halle Münsterland", kosten: 450, quelle: "Recherche", url: "https://www.data-unplugged.de", eventId: "ev_dup26" },
  { id: "k_bdaiw26x", name: "Big Data & AI World Frankfurt 2026", start: "2026-05-06", end: "2026-05-07", ort: "Frankfurt am Main", venue: "Messe Frankfurt, Halle 3", kosten: 0, quelle: "Recherche", url: "https://www.techshowfrankfurt.de/big-data-ai-world", eventId: "ev_bdaiw26" },
  { id: "k_dudd26", name: "d:u Deep Dive Berlin", start: "2026-06-11", end: "2026-06-11", ort: "Berlin", venue: "Kraftwerk Berlin", kosten: 290, quelle: "Recherche", url: "https://www.data-unplugged.de" },
  { id: "k_aicsb26", name: "AI Conference: Science x Business", start: "2026-04-14", end: "2026-04-15", ort: "Heidelberg", venue: "", kosten: 490, quelle: "Recherche", url: "https://www.gruender.de/kuenstliche-intelligenz/ki-events/" },
  { id: "k_roai26", name: "Rise of AI Conference 2026", start: "2026-05-05", end: "2026-05-06", ort: "Berlin", venue: "", kosten: 790, quelle: "Recherche", url: "https://riseof.ai", eventId: "ev_roai26" },
  { id: "k_kix26", name: "KI-X für Kommunikation", start: "2026-05-06", end: "2026-05-07", ort: "Berlin", venue: "", kosten: 990, quelle: "Recherche", url: "https://hr.ki-x.berlin/" },
  { id: "k_faz26", name: "F.A.Z. Konferenz Künstliche Intelligenz", start: "2026-06-22", end: "2026-06-23", ort: "Eltville (Kloster Eberbach)", venue: "Kloster Eberbach", kosten: 1490, quelle: "Recherche", url: "https://www.faz-konferenzen.de/kuenstliche-intelligenz/" },
  { id: "k_wad26", name: "WeAreDevelopers World Congress 2026", start: "2026-07-08", end: "2026-07-10", ort: "Berlin", venue: "CityCube", kosten: 699, quelle: "Recherche", url: "https://www.wearedevelopers.com/world-congress", eventId: "ev_wad26" },
  { id: "k_1e9_26", name: "1E9 – Festival der Zukunft 2026", start: "2026-07-02", end: "2026-07-05", ort: "München", venue: "Deutsches Museum", kosten: 349, quelle: "Recherche", url: "https://1e9.community", eventId: "ev_1e9_26" },
  { id: "k_aifh26", name: "AI Festival Heilbronn", start: "2026-07-25", end: "2026-07-26", ort: "Heilbronn", venue: "Zukunftspark Wohlgelegen", kosten: 99, quelle: "Recherche", url: "https://ip.ai", eventId: "ev_ipai26" },
  { id: "k_ijcai26", name: "IJCAI–ECAI 2026 (Int. Joint Conference on AI)", start: "2026-08-15", end: "2026-08-21", ort: "Bremen", venue: "", kosten: 850, quelle: "Recherche", url: "https://apoc-bremen.de/event/weltweit-fuehrende-ki-konferenz-kommt-im-august-2026-nach-bremen/" },
  { id: "k_kihh26", name: "KI-SUMMIT Hamburg 2026", start: "2026-09-08", end: "2026-09-08", ort: "Hamburg", venue: "Handelskammer", kosten: 249, quelle: "Recherche", url: "https://ki-summit.hamburg/" },
  { id: "k_bigbang26", name: "BIG BANG KI Festival", start: "2026-09-16", end: "2026-09-17", ort: "Berlin", venue: "6 Bühnen, 350+ Speaker", kosten: 690, quelle: "Recherche", url: "https://www.gruender.de/kuenstliche-intelligenz/ki-events/" },
  { id: "k_aids26", name: "AIDAQ – AI, Data & Quantum Summit (Bitkom)", start: "2026-09-22", end: "2026-09-23", ort: "Berlin", venue: "bcc Berlin", kosten: 550, quelle: "Recherche", url: "https://aidaq.berlin", eventId: "ev_bdai26" },
  { id: "k_bp26", name: "Bits & Pretzels 2026 (AI Stage)", start: "2026-09-28", end: "2026-09-30", ort: "München", venue: "ICM", kosten: 599, quelle: "Recherche", url: "https://www.bitsandpretzels.com", eventId: "ev_bp26" },
  { id: "k_kixhr26", name: "KI-X HR Convention", start: "2026-11-18", end: "2026-11-19", ort: "Berlin", venue: "", kosten: 990, quelle: "Recherche", url: "https://hr.ki-x.berlin/" }
];
