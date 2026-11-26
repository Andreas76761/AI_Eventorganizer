# Release-Notes · AI Messe Guide

## Version 1.2 · 26. November 2026

- **Transkript-Verzeichnis im AIW-Archiv:** neuer Bereich „Transkripte" zeigt alle 125 Mitschnitt-Programmpunkte der AI Week Frankfurt 2026 (115 davon offline lesbar) als Liste – filterbar nach **Thema** (Makrotrend aus dem Insight Radar, Zuordnung über den Sessiontitel), **Kategorie** (Keynote/Panel/Fireside …) und Tag, sortierbar nach Zeit/Thema/Kategorie/Titel; 📖-Lesen, Online-Link und Volltextsuche inklusive. Ein im Archiv fehlender Talk („Evaluation for Hypothesis Validation", 29.10.) wurde nachgetragen
- **Veranstaltungs-Übersicht nach Jahren:** Eventkarten sind jetzt unter Jahres-Überschriften (2026/2027 …) gruppiert, und jede Karte verlinkt die Veranstalter-Website (🔗, öffnet im neuen Tab)
- **Insight Radar für die großen Events:** Trend-Radare jetzt auch für den **WeAreDevelopers World Congress 2026** (234 Sessions · 225 Signale · 7 Makro-/26 Mikrotrends) und das **1E9 Festival der Zukunft 2026** (272 Programmpunkte · 219 Signale · 5 Makro-/18 Mikrotrends) – mit allen Radar-Features (SVG-Radar mit Zoom, Trendkarten, Alle-Trends-Tabelle, Suche, Sessions & Firmen, Methodenblatt). Datengrundlage sind die veröffentlichten Programme (keine Transkripte) – das Methodenblatt deklariert das transparent; Generator: `scripts/radar-generator.py` (wiederverwendbar für 2027-Ausgaben). Die kleineren Events haben nur Kurz-Archive und geben noch kein Radar her
- **Hell/Dunkel-Schalter:** fester Knopf oben rechts wechselt zwischen dunklem (Neon Deep) und hellem Hintergrund (zuletzt genutztes helles Design; Sonne-/Mond-Icon zeigt die jeweils nächste Aktion)
- **Schnellfilter Veranstaltungen:** vier Auswahlfelder (Ort, Jahr, Monat, Thema) über der Eventliste – wirken auf Übersicht, Deutschlandkarte, Zeitleiste, Merkliste und Statistik; „Zurücksetzen"-Knopf erscheint bei aktivem Filter
- **Seed v8 – 7 weitere Events 2027:** OMR Festival Hamburg 3.–5.5. *(Veranstalter)*, re:publica Berlin 10.–12.5. *(Eventkalender, unbestätigt)*, KI-X Konferenz Berlin 2.–3.3., AI:CAN Berlin 2.6. (ab 399 €), DIKITALE Düsseldorf 16.–17.6. (149–499 €), Accelerate Tomorrow AI Summit Berlin 15.–16.7. *(visitBerlin)*, AI Week Frankfurt ~25.–29.10. *(geschätzt)* – damit 29 Seed-Events
- **Jahresfilter:** Dashboard und „Kosten & Budget" lassen sich per Chip auf ein Jahr umschalten (Alle Jahre / 2026 / 2027 …); Kennzahlen, Kostenaufteilung je Veranstaltung und CSV-Export (Dateiname inklusive) folgen der Auswahl. Titel und Oberfläche sind nicht mehr auf 2026 festgelegt – die App läuft jahresübergreifend
- **Vollbackup:** Der JSON-Export unter „Konto & Daten“ sichert jetzt auch alle Dateien, Bilder und Projekteinträge (IndexedDB) und stellt sie beim Import wieder her (Format `aimg-export/2`, alte Exporte bleiben lesbar); zusätzlich **ZIP-Backup** (deutlich kompakter, Dateien nativ statt Base64) mit Export und Import
- **Cloud-Datei-Backup:** angemeldete Nutzer sichern Dateien, Bilder und Projekteinträge per Knopf in ihren privaten Supabase-Storage-Ordner und stellen sie auf jedem Gerät wieder her (RLS: nur der eigene Ordner)
- **Sync-Konfliktschutz:** der Zustands-Sync erkennt, wenn ein anderes Gerät zwischenzeitlich gespeichert hat (Versionszähler + Gerätekennung), und fragt nach statt still zu überschreiben
- **Schneller & runder:** Skripte laden mit `defer`, das Insight-Radar-Modul erst beim Öffnen; Archiv-Suche tippt flüssig (Teil-Rendering) und zeigt **Fundstellen-Snippets** aus Transkripten mit Hervorhebung und Sprung zur Stelle; Event-Auswahl gruppiert (Meine Events zuerst) mit Suchfeld; Veranstaltung ↔ Archiv sind gegenseitig verlinkt; Mobile-Darstellung der Archive korrigiert; `/data/*` wird auf Vercel gecacht
- **Cloud-Modus live:** ai-messe-guide.vercel.app läuft jetzt mit Supabase-Anbindung (Login, MFA, Sync) – die Zugangsdaten werden beim Vercel-Build aus Umgebungsvariablen erzeugt (`scripts/make-config.js`), der anon-Key bleibt durch RLS-Policies abgesichert
- **Offline-Transkripte:** 115 Vortrags-Mitschriften der AI Week Frankfurt 2026 sind lokal gesichert (`data/aiw-transkripte-2026.json`) und direkt im Programm lesbar („📖 Transkript lesen“) – unabhängig von phont.ai
- **Projekt-Export/-Import:** jedes Event-Projekt lässt sich komplett als JSON exportieren und (zusammenführend) in ein anderes Gerät/Projekt importieren
- **Sechs weitere Archive:** DLD Munich, NUEdigital, KI Festival Heilbronn (IPAI), MLcon, AI@HPI und KI-X HR Convention (je 2025/2026)
- **Bits & Pretzels 2027:** Ticketshop offen – Preisstaffel ab 270 € erfasst (Seed v7)
- **Präsentation:** Folie 11 „Neu im November 2026“ ergänzt (PPTX + PDF)

- **Neues Register „Insight Radar“** – Trend-Radar je Veranstaltung (Format `trendradar-export/1`):
  - Start mit **Event-Auswahl**; mitgeliefert: **AI Week Frankfurt 2026** (115 Sessions, 1.053 belegte Aussagen, 13 Makro-/91 Mikrotrends)
  - Interaktives **SVG-Radar** mit Makro→Mikro-Zoom, Sektoren **Dimensionen/STEEP**, Ringen **Belegstärke/Momentum**, Punktgröße = Sessions, Tooltips und nummerierter Legende
  - **Trendkarten** mit Definition, Kennzahlen, Absender-Mix, Belegzitaten (Zitat + Fundstelle + Quellen-Link), Gegenstimmen und verwandten Trends; Kopieren als Markdown/HTML, Radar-Export als **PNG**
  - Ansichten **Sessions & Firmen** (Vortrags- und Ausstellerverzeichnis), **Alle Trends** (Tabelle), **Suche** (Volltext über Aussagen, Zitate, Speaker, Firmen), **Methodenblatt**
  - **Live-Filter** (Absenderrolle, Beitragsart, Evidenz, Tag, Track) rechnen Score und Ringe neu
  - **Import** weiterer Events als JSON-Export oder generierte Radar-HTML; Datensätze bleiben lokal (IndexedDB)
- **Event-Archive im Insight Radar** (26.11.2026) – je Event nach Jahren getrennt (2024 · 2025 · 2026), mit Jahres-Tabs, Bereichs-Filter und Live-Suche:
  - **AI Week Frankfurt:** 2026 mit vollem Programm (188 Punkte, **124 Vorträge mit Transkript- & Summary-Link** auf phont.ai), 178 Speakern, 22 Ausstellern mit Standnummern und Websites sowie 31 Workshops; 2025/2024 mit Eckdaten, Highlights und Quellen-Links (Recap, Aftermovie, Fotos)
  - **WeAreDevelopers World Congress:** 2026 mit 241 Sessions und 270 Speakern aus der Agenda (Keynote Thomas Dohmke), 2025/2024 mit Eckdaten (15.000 Teilnehmer, ~500 Talks), After-Movies und Recaps
  - **„Mein Projekt“ je Event und Jahr:** eigene lokale Datenhaltung (IndexedDB) in jedem Archiv – Fotos/Bilder/Dateien per Upload oder **Zwischenablage** (Button oder Strg+V), Informationen als Texteinträge; jeder Eintrag mit **Datum, Erfasser, Label und Notiz**, editierbar, herunterladbar, durchsuchbar; automatische Foto-Verkleinerung
  - **Sechs weitere Messe-Archive 2025/2026** (je mit „Meine Teilnahme“-Status aus der App): **1E9 Festival der Zukunft** (2026 komplett: 284 Programmpunkte mit Inhaltsbeschreibung je Vortrag/Workshop, 313 Speaker mit Bio, 254 Firmen), **data:unplugged** (10.000+ Teilnehmende, Hoeneß/Lanz/DeepL), **Rise of AI** (10. Ausgabe), **Big Data & AI World Frankfurt** (Tech Show, BARC), **AIDAQ/Bitkom** (220 Speaker, Keynote Bär) und **Bits & Pretzels** („Human after all“, Trevor Noah/Steven Bartlett) – jeweils mit Eckdaten, Schlüssel-Personen/-Firmen und Quellen-Links

## Daten-Update · 21. November 2026 (Seed v6)

- **2027er-Termine ergänzt** (werden per Migration automatisch in bestehende Stände übernommen): DLD München 14.–16.01. *(geschätzt, invite-only)*, Rise of AI Berlin 12.05., Big Data & AI World Frankfurt 19.–20.05., NUEdigital Nürnberg 14.–24.06., WeAreDevelopers 14.–16.07. (neuer Ort: **Messe Berlin**, 5 Preisstufen ab 299 €), AIDAQ Berlin 21.–22.09. *(geschätzt)*, Bits & Pretzels München 27.–29.09.
- Zusammen mit den im Oktober ergänzten Terminen (MLcon, AI@HPI, KI-X HR, data:unplugged 2027, 1E9 2027) enthält die App jetzt **22 Seed-Events**; die Auswahlliste zeigt 2027 als eigenes Jahr mit 9 Kandidaten
- Geschätzte Termine sind in App und Auswahlliste als „Termin geschätzt" gekennzeichnet

## Version 1.1 · 8. Juli 2026

**🌐 Die App ist live: https://ai-messe-guide.vercel.app** (GitHub → Vercel gekoppelt, jeder Push deployt automatisch)

Seit 1.0 sind dazugekommen:

- **📱 PWA:** installierbar auf Handy/Desktop („Zum Startbildschirm hinzufügen“), läuft offline (Service Worker), eigenes App-Icon
- **⬆ Programm-Import:** ganze Agenden aus CSV/JSON einlesen (Duplikaterkennung, Speaker werden automatisch angelegt); Beispieldatei mit 241 WAD-Sessions liegt bei
- **🧾 Reisekostenabrechnung als PDF:** druckfertig mit Reiseverlauf, Netto/USt/Brutto, Beleg-Währungen, Erstattungsbetrag und Unterschriftszeilen
- **📣 Posts-Register:** je Veranstaltung drei generierte LinkedIn-Posts (Save-the-Date / Live / Recap) aus Messedaten, Agenda und Erkenntnissen – mit Share-Bild (1200×627), editierbar, kopierbar, als PNG herunterladbar

- **Festival-App-Parität:** Programm-Tab (Sessions mit Tag/Zeit/Bühne, ★-Tagesplan), Speaker-Verzeichnis mit Bio & Promi-Rating, automatisches Firmenverzeichnis, Statistik-Bereich, interaktive Deutschlandkarte mit Stadt-Chips & Kategorie-Filter, Trends & Nuggets, In-App-Foliengalerie (PDF), 🎤 Diktierfunktion für Notizen, 🔎 OCR für Vortragsfotos (durchsuchbar, als Notiz übernehmbar), automatische Foto-Verkleinerung beim Upload
- **Team-Kollaboration ohne Server:** Event-Paket exportieren/importieren mit Zusammenführen statt Ersetzen, „Wer kommt mit?“-Steckbrief, Treffen-Kalendereinladung (.ics + Mail-Entwurf), Terminabstimmung (Doodle-light), Session-Abdeckung im Team (Laufzettel, Unbesetzt-Filter), Aufgabenliste mit Zuständigen
- **Community-Ausbau:** ☰-Bereiche, Kurzprofile (Firma, Alter, Wohnort, Interessen, Fähigkeiten, Projekt, LinkedIn, Suche/Biete), automatisches Matching, Direktnachrichten mit Lesestatus
- **Kosten:** Netto/USt/Brutto, Fremdwährungen mit EZB-Live-Kurs und EUR-Umrechnung, erweiterter CSV-Export
- **Auswahlliste:** dritte Option „Vielleicht“, 👥-Anzeige der Community-Teilnehmer, Termine gegen Veranstalter-Websites verifiziert
- **Sonstiges:** JSON-Daten-Import (Backup/Umzug), Cache-versionierte Assets, Impressum/Datenschutz mit editierbaren Beispieldaten

---

# Release-Letter · AI Messe Guide 1.0

**Release-Datum:** 6. Juli 2026 · **Lizenz:** MIT · **Plattform:** Web (statisch, Vercel-ready) · **Backend:** optional Supabase

Liebe Nutzerinnen und Nutzer,

mit Version 1.0 veröffentlichen wir den AI Messe Guide: eine App, die den kompletten Lebenszyklus eines Messebesuchs abbildet – vom Entdecken einer AI-Konferenz über Anmeldung, Reise- und Kostenplanung bis zu Community-Austausch, Materialsammlung und Nachbetrachtung. Alle Funktionen im Überblick:

## 🎪 Veranstaltungsverwaltung
- Veranstaltungskalender (Monatsansicht + Jahresliste) mit farbigen Termin-Chips
- 10 vorbefüllte AI-Events 2026 (verifiziert am 06.07.2026, editierbar) + eigene Veranstaltungen
- Live-Suche über Name, Ort, Venue, Kategorie und Thema
- Details-Popup mit Bewertung (1–5 ★), Teilnahme ✓/✕ und 🔖 Merker
- Status-Workflow: Interessiert → Angemeldet → Bezahlt → Besucht (inkl. Tickettyp, Zahlungsart, Bestell-Nr.)

## 📋 Auswahlliste
- 29 kuratierte AI-Veranstaltungen 2025/2026 aus Web-Recherche + Google-Kalender-Import
- Teilnahme Ja/Nein mit automatischer Übernahme in die App (duplikatfrei über Verknüpfungen)
- Kosten je Kandidat direkt editierbar, Filter nach Jahr und Entscheidungsstatus

## 🚆 Reise & Kosten
- Reiseabschnitte mit Pkw, Bahn, Flug, ÖPNV, Fernbus u. a. inkl. Zeiten und Kosten; Unterkunftsverwaltung
- Automatische Kostenposten aus Anmeldung (Eintritt), Reise (Fahrt) und Hotel (Übernachtung); Verpflegung/Sonstiges manuell
- Dashboard-Kostenaufteilung je Kategorie und je Veranstaltung mit Summenzeile; CSV-Export

## 📆 Kalender-Integration
- „In Google Kalender eintragen“ je Veranstaltung/Kandidat (vorbefüllter Termin)
- .ics-Export einzeln oder für alle Zusagen gesammelt (Google/Outlook/Apple)

## 👥 Community
- Mitgliederverwaltung; Anmeldung per E-Mail (lokaler Demo-Code oder Cloud-Konto)
- Treffen planen (Mittagessen, vor/während der Konferenz, Nachbetrachtung) mit Ein-Klick-Teilnahme
- Mitfahrgelegenheiten mit Platzverwaltung (anbieten, mitfahren, aussteigen)
- Austausch-Feed je Veranstaltung
- 💬 Direktnachrichten mit Ungelesen-Zähler und Lesebestätigung (✓/✓✓)

## 📎 Materialien & Sharing
- Notizen, Präsentationen/Dokumente und Bildergalerie je Veranstaltung
- Sharing-Runden: geteilte Präsentationen sehen nur angemeldete Sharing-Mitglieder; 🔗/🔒 je Datei

## 🎨 Drei Designs
- 🌌 Neon Deep (dunkel) · 📰 Editorial Light (Serif-Magazin) · 🏢 Corporate Clean (Dashboard) – umschaltbar, Wahl wird gespeichert

## ☁️ Cloud-Modus (optional, Supabase)
- E-Mail+Passwort-Authentifizierung mit Double-Opt-in
- **MFA/2FA per Authenticator-App (TOTP)** mit QR-Einrichtung
- Zustands-Synchronisation pro Nutzer, isoliert durch Row-Level-Security
- Ohne Konfiguration: vollwertiger Lokalmodus (alle Daten bleiben im Browser)

## 🔐 Datenschutz & Recht
- DSGVO: JSON-Datenexport (Art. 20), Konto-Selbstlöschung inkl. aller Inhalte (Art. 17), Löschung aller lokalen Daten
- Datenschutzerklärung und EU-AI-Act-Transparenzseite (die App enthält kein KI-System; Seed-Daten als KI-unterstützt recherchiert gekennzeichnet)
- Keine Cookies, kein Tracking, keine Analytics; Security-Header im Deployment

## 🚀 Deployment
- Statische Site: GitHub → Vercel in Minuten (vercel.json inklusive)
- supabase/schema.sql richtet Datenbank, RLS-Policies und DSGVO-Löschfunktion ein
- Zugangsdaten getrennt in js/config.js (gitignored), Vorlage liegt bei

**Bekannte Einschränkungen:** Community-Daten (Beiträge, Nachrichten, Mitfahrten) werden im Cloud-Modus pro Nutzerkonto synchronisiert, aber noch nicht zwischen verschiedenen Konten geteilt – die geteilten Tabellen sind als Ausbaustufe im Schema dokumentiert. Zahlungen werden verwaltet, nicht abgewickelt. Impressum/Verantwortlicher sind vor dem öffentlichen Betrieb einzutragen.

Viel Erfolg auf deinen AI-Messen 2026!

*Das AI Messe Guide Team*
