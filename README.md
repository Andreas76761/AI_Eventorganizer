# AI Messe Guide 2026

Verwaltungs-App für AI-Messen, -Konferenzen und -Veranstaltungen in Deutschland. Läuft als statisches Frontend mit optionalem Supabase-Backend (Auth mit MFA, Cloud-Sync, DSGVO-Löschung) – ohne Konfiguration komplett lokal im Browser.

**🌐 Live:** https://ai-messe-guide.vercel.app · **Doku:** [Benutzerhandbuch](docs/BENUTZERHANDBUCH.md) · [Release-Notes](docs/RELEASE.md) · [Präsentation (PDF)](docs/AI_Messe_Guide_Praesentation.pdf)

## Deployment-Status

- **GitHub → Vercel ist gekoppelt:** Jeder Push auf `main` deployt automatisch nach https://ai-messe-guide.vercel.app (Projekt `ai-messe-guide`, statische Site, `vercel.json` mit Security-Headern).
- **Supabase (optional, für Cloud-Login/MFA/Sync):** Projekt anlegen (EU-Region) → `supabase/schema.sql` im SQL-Editor ausführen → MFA (TOTP) aktivieren → URL + anon-Key in `js/config.js` (Vorlage `js/config.example.js`; Datei ist gitignored).
- **⚠️ Rechtliches:** Impressum (`rechtliches.html`) und Verantwortlicher (`datenschutz.html`) enthalten aktuell **Mustermann-Beispieldaten** – vor ernsthaftem öffentlichen Betrieb durch echte Angaben ersetzen (gelbe Hinweiskästen markieren die Stellen).

## Betriebsmodi

- **Lokal (Standard, ohne `js/config.js`):** alle Daten in LocalStorage/IndexedDB des Browsers; E-Mail-Login im Demo-Modus (Code wird angezeigt).
- **Cloud (mit `js/config.js`):** Supabase-Auth mit E-Mail + Passwort und **MFA (TOTP/Authenticator-App)**; der App-Zustand wird pro Nutzer verschlüsselt übertragen und per **Row-Level-Security** isoliert gespeichert (`supabase/schema.sql`); Konto-Selbstlöschung über die RPC-Funktion `delete_user()`.

## DSGVO & EU AI Act

- „Konto & Daten“ (⚙ in der Seitenleiste): **JSON-Export** aller Daten (Art. 20), **JSON-Import** (Backup zurückspielen / Umzug auf anderen Rechner), **Konto-Löschung** inkl. aller Inhalte (Art. 17), Löschung aller lokalen Browserdaten.
- `datenschutz.html` (lokale Datenhaltung, Cloud-Modus, Rechte) und `rechtliches.html` (Impressum-Platzhalter, EU-AI-Act-Transparenz: die App enthält kein KI-System; Seed-Daten sind als KI-unterstützt recherchiert gekennzeichnet).
- Keine Tracking-Cookies, keine Analytics, Security-Header via `vercel.json`.

## Designs

3 umschaltbare Designs (Leiste unten in der Seitenleiste, wird gespeichert): 🌌 **Neon Deep** (dunkel, Standard) · 📰 **Editorial Light** (helles Serif-Magazin) · 🏢 **Corporate Clean** (helles Dashboard, blaue Sidebar).

## Funktionen

- **Dashboard** – KPIs, nächste Veranstaltung mit Countdown, Kostenaufteilung (Eintritt/Fahrt/Hotel/Verpflegung) je Kategorie und je Veranstaltung, letzte Community-Beiträge
- **Veranstaltungskalender** – Monatsansicht + Jahresliste, eigene Veranstaltungen anlegen/bearbeiten
- **Veranstaltungen mit ☰-Bereichen** – Übersicht, **interaktive Deutschlandkarte** (Stadt-Chips, Kategorie-Filter, Inline-Detailpanel), Zeitleiste, Merkliste, Archiv, **Statistik** (Kategorien, Städte, Themen, Top-Firmen)
- **Programm je Veranstaltung** – Sessions mit Tag/Zeit/Bühne/Thema, Tages- und Bühnen-Filter, ★-Favoriten als persönlicher Tagesplan, **Team-Abdeckung** (wer geht rein, Laufzettel je Person, Unbesetzt-Filter)
- **Speaker & Firmen** – Referenten mit Bio, Themenfilter und Promi-Rating (1–5 ★); Firmenverzeichnis automatisch aggregiert
- **Trends & Nuggets** – Nachbetrachtung je Veranstaltung: Trends mit Relevanz, Kernaussagen mit Quelle
- **Anmeldung & Bezahlung** – Status (Interessiert → Angemeldet → Bezahlt → Besucht), Tickettyp, Zahlungsart, Bestellnummer. Die App *verwaltet* den Zahlungsstatus; gebucht wird beim Veranstalter.
- **Reise** – Reiseabschnitte mit Pkw, Bahn, Flug, ÖPNV, Fernbus u. a. inkl. Zeiten und Kosten; Übernachtungen
- **Kosten** – Eintritt, Fahrtkosten, Übernachtung entstehen automatisch aus Anmeldung/Reise; Verpflegung & Sonstiges manuell mit **Netto/USt/Brutto und Fremdwährungen** (EZB-Live-Kurs, editierbar); Auswertung nach Kategorie und Veranstaltung; erweiterter CSV-Export
- **Community mit ☰-Bereichen** – Kurzprofile (Firma, Alter, Wohnort, Interessen, Fähigkeiten, Projekt, LinkedIn, **Suche/Biete**), **Matching** (Suche↔Biete + gemeinsame Interessen), Meine Events, Mitfahrgelegenheiten mit Platzverwaltung, Treffen mit **Terminabstimmung (Doodle-light)** und **Kalender-Einladung (.ics + Mail)**, **Aufgabenliste** mit Zuständigen
- **Team-Kollaboration ohne Server** – **Event-Paket** exportieren/importieren mit Zusammenführen statt Ersetzen (ohne persönliche Kosten/Reisen), „Wer kommt mit?“-Steckbrief für Messenger
- **Materialien** – Notizen mit **🎤 Diktierfunktion**, Präsentationen mit Sharing-Runde und **📖 In-App-Foliengalerie** (PDF), Bilder mit **🔎 OCR-Texterkennung**, Volltextsuche und automatischer Verkleinerung beim Upload
- **Auswahlliste** – 29 kuratierte AI-Veranstaltungen 2025/2026 (Quellen: Web-Recherche + eigener Google-Kalender); Teilnahme **Ja / Vielleicht / Nein**, Kosten editierbar, 👥-Anzeige der Community-Teilnehmer; „Ja“ übernimmt das Event in die App
- **Google-Kalender-Anbindung** – pro Veranstaltung/Kandidat „In Google Kalender eintragen“ (Direktlink) sowie .ics-Export (einzeln oder alle Zusagen gesammelt) zum Import in beliebige Kalender
- **Nachrichten** – Direktnachrichten zwischen Mitgliedern (💬 in der Navigation, ✉ bei jedem Mitglied): Unterhaltungen mit Chat-Blasen, Ungelesen-Zähler in der Seitenleiste, Gelesen-Bestätigung (✓/✓✓); nur für angemeldete Nutzer
- **E-Mail-Anmeldung & Sharing** – Login per E-Mail + Bestätigungscode (lokaler Demo-Modus: Code wird angezeigt, kein Mailserver); neue E-Mail-Adressen registrieren sich als Mitglied. Angemeldete Nutzer können: Beiträge schreiben, sich zu Treffen an-/abmelden, bei Mitfahrgelegenheiten ein-/aussteigen, Präsentationen hochladen und die **Sharing-Runde** je Veranstaltung abonnieren (geteilte Dateien sehen nur Sharing-Mitglieder; 🔒/🔗 pro Datei umschaltbar). Messe-Suche über Name/Ort/Thema inkl. Treffern in der Auswahlliste.

## Architektur

```
index.html        – Shell mit Sidebar-Navigation
css/style.css     – dunkles, modernes UI (Indigo/Cyan)
js/data.js        – Seed-Daten (10 AI-Events 2026, editierbar) + Konstanten
js/karte.js       – Deutschlandkarte (16 Bundesländer als SVG-Pfade) + 36 Städte-Koordinaten
js/auswahl.js     – Auswahlliste: 29 Kandidaten 2025/2026 (Recherche + Google-Kalender)
js/db.js          – IndexedDB-Helfer für Dateien & Bilder
js/cloud.js       – Supabase: Auth (MFA), Zustands-Sync, Konto-Löschung
js/config.example.js – Vorlage für Supabase-Zugangsdaten (echte config.js in .gitignore)
js/app.js         – Zustand, Routing, alle Ansichten und Formulare
css/theme-*.css   – 3 Designs (Neon Deep, Editorial Light, Corporate Clean)
supabase/schema.sql – Tabellen, RLS-Policies, delete_user()-RPC
datenschutz.html / rechtliches.html – DSGVO & EU-AI-Act-Seiten
vercel.json / LICENSE / .gitignore – Deployment & Lizenz (MIT)
```

- Zustand in `localStorage` unter `aimg2026_state_v1` (Events, Nutzer, Anmeldungen, Reisen, Kosten, Treffen, Mitfahrten, Beiträge, Notizen)
- Binärdaten (Präsentationen, Bilder) in IndexedDB `aimg2026_files`
- Mehrbenutzer-Konzept: Nutzerprofile lokal; über „wechseln" schreibt man als anderes Mitglied (für gemeinsame Nutzung an einem Rechner bzw. als Planungswerkzeug)

## Starten

```
python -m http.server 8933 --directory C:/2026/Claude/AI_Messe_Guide
```

Dann http://localhost:8933 öffnen. Alternativ Preview-Konfiguration `ai-messe-guide` in `C:\2026\Claude\1E9_2026\.claude\launch.json`.

## Hinweis zu den Seed-Daten

Die 10 vorbefüllten Veranstaltungen (DLD, data:unplugged, Rise of AI, Big-Data.AI Summit, Nürnberg Digital, WeAreDevelopers, 1E9 Festival der Zukunft, KI-Festival Heilbronn, Bits & Pretzels, Big Data & AI World) sind Startwerte – Termine und Preise vor Buchung auf der jeweiligen Website prüfen (in der App als Hinweis markiert, alles editierbar).
