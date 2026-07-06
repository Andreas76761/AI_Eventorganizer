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
