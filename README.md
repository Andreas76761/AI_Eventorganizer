# AI Messe Guide 2026

Verwaltungs-App für AI-Messen, -Konferenzen und -Veranstaltungen in Deutschland. Läuft als statisches Frontend (Vercel-tauglich) mit optionalem Supabase-Backend (Auth mit MFA, Cloud-Sync, DSGVO-Löschung) – ohne Konfiguration komplett lokal im Browser.

## Veröffentlichung (GitHub → Vercel → Supabase)

1. **GitHub:** Repository erstellen und pushen (`git init` ist bereits erledigt):
   ```
   git remote add origin https://github.com/DEIN-NAME/ai-messe-guide.git
   git push -u origin main
   ```
2. **Supabase:** Projekt anlegen (Region EU, z. B. Frankfurt) → SQL-Editor → Inhalt von `supabase/schema.sql` ausführen → unter *Authentication* E-Mail-Anmeldung + MFA (TOTP) aktivieren → *Project Settings → API*: URL und anon-Key kopieren.
3. **Konfiguration:** `js/config.example.js` nach `js/config.js` kopieren und Werte eintragen (steht in `.gitignore`). Für Vercel: Datei im Dashboard als Teil des Deployments pflegen oder per Build-Step aus Umgebungsvariablen erzeugen.
4. **Vercel:** `vercel` im Projektordner ausführen (CLI ist installiert) oder das GitHub-Repo im Vercel-Dashboard importieren – keine Build-Einstellungen nötig (statische Site, `vercel.json` liegt bei).
5. **Rechtliches vor dem Livegang:** Platzhalter in `rechtliches.html` (Impressum) und `datenschutz.html` (Verantwortlicher) ausfüllen – ohne diese Angaben nicht öffentlich betreiben.

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

- **Dashboard** – KPIs, nächste Veranstaltung mit Countdown, Kostenverteilung, letzte Community-Beiträge
- **Veranstaltungskalender** – Monatsansicht + Jahresliste, eigene Veranstaltungen anlegen/bearbeiten
- **Anmeldung & Bezahlung** – Status (Interessiert → Angemeldet → Bezahlt → Besucht), Tickettyp, Zahlungsart, Bestellnummer. Die App *verwaltet* den Zahlungsstatus; gebucht wird beim Veranstalter.
- **Reise** – Reiseabschnitte mit Pkw, Bahn, Flug, ÖPNV, Fernbus u. a. inkl. Zeiten und Kosten; Übernachtungen
- **Kosten** – Eintritt, Fahrtkosten, Übernachtung entstehen automatisch aus Anmeldung/Reise; Verpflegung & Sonstiges manuell; Auswertung nach Kategorie und Veranstaltung; CSV-Export
- **Community** – weitere Nutzer anlegen, Teilnehmer je Veranstaltung, Mitfahrgelegenheiten (anbieten/mitfahren), Treffen (Mittagessen, vor/während der Konferenz, Nachbetrachtung), Austausch-Feed je Veranstaltung
- **Materialien** – Notizen, Präsentationen/Dokumente und Bilder je Veranstaltung (Upload, Download, Galerie)
- **Auswahlliste** – 28 kuratierte AI-Veranstaltungen 2025/2026 (Quellen: Web-Recherche + eigener Google-Kalender inkl. Abos „KI-Café“/„AI xpress“); Teilnahme Ja/Nein, Kosten editierbar; „Ja“ übernimmt das Event in die App
- **Google-Kalender-Anbindung** – pro Veranstaltung/Kandidat „In Google Kalender eintragen“ (Direktlink) sowie .ics-Export (einzeln oder alle Zusagen gesammelt) zum Import in beliebige Kalender
- **Nachrichten** – Direktnachrichten zwischen Mitgliedern (💬 in der Navigation, ✉ bei jedem Mitglied): Unterhaltungen mit Chat-Blasen, Ungelesen-Zähler in der Seitenleiste, Gelesen-Bestätigung (✓/✓✓); nur für angemeldete Nutzer
- **E-Mail-Anmeldung & Sharing** – Login per E-Mail + Bestätigungscode (lokaler Demo-Modus: Code wird angezeigt, kein Mailserver); neue E-Mail-Adressen registrieren sich als Mitglied. Angemeldete Nutzer können: Beiträge schreiben, sich zu Treffen an-/abmelden, bei Mitfahrgelegenheiten ein-/aussteigen, Präsentationen hochladen und die **Sharing-Runde** je Veranstaltung abonnieren (geteilte Dateien sehen nur Sharing-Mitglieder; 🔒/🔗 pro Datei umschaltbar). Messe-Suche über Name/Ort/Thema inkl. Treffern in der Auswahlliste.

## Architektur

```
index.html        – Shell mit Sidebar-Navigation
css/style.css     – dunkles, modernes UI (Indigo/Cyan)
js/data.js        – Seed-Daten (10 AI-Events 2026, editierbar) + Konstanten
js/auswahl.js     – Auswahlliste: 28 Kandidaten 2025/2026 (Recherche + Google-Kalender)
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
