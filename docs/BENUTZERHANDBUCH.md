# AI Messe Guide – Benutzerhandbuch

Version 1.0 · Stand: Juli 2026

Der AI Messe Guide verwaltet deine AI-Messen, -Konferenzen und -Veranstaltungen: vom Entdecken über Anmeldung, Reise- und Kostenplanung bis zu Community, Nachrichten und Materialien. Dieses Handbuch führt durch alle Funktionen.

---

## 1. Erste Schritte

### 1.1 App öffnen
- **Lokal:** `index.html` im Browser öffnen oder einen kleinen Webserver starten (`python -m http.server 8933`).
- **Online:** die von dir veröffentlichte Vercel-Adresse aufrufen.

Beim ersten Start ist die App mit 10 AI-Veranstaltungen 2026 vorbefüllt (als „Startdatensatz“ markiert – Termine vor Buchung beim Veranstalter prüfen). Alle Daten werden **lokal in deinem Browser** gespeichert; im Cloud-Modus zusätzlich verschlüsselt in deinem Supabase-Konto synchronisiert.

### 1.2 Anmelden
Klicke unten links auf **„🔐 Mit E-Mail anmelden“**:
- **Lokaler Modus:** E-Mail eingeben → 6-stelliger Bestätigungscode wird angezeigt (Demo-Modus ohne Mailserver) → Code eintippen. Unbekannte E-Mail-Adressen registrieren sich dabei als neues Mitglied (Name, Stadt).
- **Cloud-Modus:** E-Mail + Passwort; neue Konten über „Neues Konto registrieren“ mit Bestätigungslink per E-Mail. Ist MFA aktiv, wird zusätzlich der Code deiner Authenticator-App abgefragt.

Ohne Anmeldung kannst du alles ansehen und deine eigene Planung führen; Community-Aktionen (Beiträge, Treffen, Mitfahrten, Nachrichten, Datei-Sharing) erfordern die Anmeldung.

### 1.3 Design wählen
Unten in der Seitenleiste stehen drei Designs: 🌌 **Neon Deep** (dunkel), 📰 **Editorial Light** (helles Magazin), 🏢 **Corporate Clean** (helles Dashboard). Die Wahl wird gespeichert.

---

## 2. Dashboard

Die Startseite zeigt:
- **Kennzahlen:** Anzahl Veranstaltungen, Anmeldungen, Gesamtkosten, nächste Veranstaltung mit Countdown.
- **Kostenaufteilung:** eigene KPI-Reihe für Eintritt / Fahrtkosten / Übernachtung / Verpflegung sowie die Tabelle **„Kostenaufteilung je Veranstaltung“** mit Summenzeile.
- **Auswahllisten-Banner:** wie viele Veranstaltungen noch auf deine Teilnahme-Entscheidung warten.
- **Anstehende Veranstaltungen** mit **Details**-Button (siehe 4.4) und die letzten Community-Beiträge.

---

## 3. Kalender

Monatsansicht mit farbigen Veranstaltungs-Chips (mehrtägige Termine erscheinen an jedem Tag) und Jahresliste darunter. Über ‹ › blätterst du durch die Monate; **„+ Veranstaltung“** legt eigene Termine an.

---

## 4. Veranstaltungen

Auch diese Ansicht hat oben rechts ein **☰-Menü** mit fünf Bereichen:
- **🎪 Übersicht** — das Kartenraster (Standard)
- **🗺 Deutschlandkarte** — alle Veranstaltungsorte auf der Karte (16 Bundesländer), nach dem Muster des Standorte-Tabs der 1E9-Festival-App: Kreisgröße und Zahl zeigen die Anzahl der Events pro Stadt; rechts die **Stadt-Chips** mit Zählern; Klick auf Marker oder Chip wählt die Stadt aus (goldene Hervorhebung) und zeigt ihre Veranstaltungen **direkt im Panel** darunter (nochmal klicken hebt die Auswahl auf). Zusätzlich zu Suche und Statusfilter gibt es eine **Kategorie-Filterzeile** (Konferenz, Summit, Festival, Kongress, Messe), die live auf Karte und Chips wirkt.
- **📆 Zeitleiste** — chronologisch nach Monaten gruppiert
- **🔖 Merkliste** — alles, was du im Details-Popup vorgemerkt oder bewertet hast
- **🗄 Archiv** — vergangene Veranstaltungen für die Nachbetrachtung
- **📈 Statistik** — Auswertungen über alles: Veranstaltungen nach Kategorie/Stadt/Status, Session- und Speaker-Themen, Top-Firmen nach Speakern

### 4.1 Suchen und filtern
Das Suchfeld filtert live nach Name, Ort, Venue, Kategorie und Beschreibung. Treffer, die nur in der Auswahlliste existieren, werden als Hinweis-Banner angezeigt. Filter-Chips: Alle / Anstehend / Angemeldet / Bezahlt / Besucht.

### 4.2 Anlegen und bearbeiten
**„+ Neue Veranstaltung“** bzw. **„✎ Bearbeiten“** im Detail: Name, Kategorie, Ort, Venue, Zeitraum, Ticketpreis, Farbe, Website, Beschreibung.

### 4.3 Die sechs Tabs einer Veranstaltung
| Tab | Inhalt |
|---|---|
| **Übersicht** | Beschreibung, Eckdaten, Google-Kalender-/.ics-Export, Teilnehmer, Schnellstatistik |
| **Programm** | Sessions mit Tag, Zeit, Bühne, Thema und Speaker-Verknüpfung; Filter nach Tag/Bühne; ★ markiert Favoriten — mit „Nur Favoriten“ wird daraus dein persönlicher Tagesplan |
| **Speaker** | Referenten-Verzeichnis mit Rolle, Firma, Thema, Bio und **Promi-Rating** (1–5 ★); Themenfilter; Detailansicht zeigt die Sessions des Speakers; darunter das automatisch aggregierte **🏢 Firmenverzeichnis** |
| **Anmeldung & Bezahlung** | Status (Interessiert → Angemeldet → Bezahlt → Besucht), Tickettyp, Preis, Zahlungsart, Bestell-Nr., „Als bezahlt markieren“. Die App verwaltet den Status – gebucht wird beim Veranstalter |
| **Reise** | Reiseabschnitte (Pkw, Bahn, Flug, ÖPNV, Fernbus …) mit Zeiten und Kosten; Unterkünfte mit Check-in/-out |
| **Kosten** | alle Posten der Veranstaltung; Eintritt/Fahrt/Hotel entstehen automatisch, Verpflegung & Sonstiges manuell |
| **Community** | Teilnehmer, Treffen, Mitfahrgelegenheiten, Austausch-Feed (siehe 7) |
| **Materialien** | Notizen (mit 🎤 Diktat), Präsentationen mit Sharing-Runde und 📖 Foliengalerie, Bildergalerie mit 🔎 OCR (siehe 8) |
| **Trends & Nuggets** | Nachbetrachtung: 🧭 Trends mit Relevanz (1–5 ●) und Einschätzung, 💎 Nuggets als Kernaussagen/Zitate mit Quelle |

### 4.4 Details-Popup
Der **Details**-Button (Dashboard/Listen) öffnet die Kurzübersicht: Datum, Ort, Status, Kosten mit Aufteilung, Inhalt, Website – plus **Bewertung (1–5 Sterne)**, **Teilnahme ✓/✕** und **🔖 Merker** zum Vormerken.

---

## 5. Auswahlliste

Kuratierte AI-Veranstaltungen 2025/2026 aus Web-Recherche und deinem Google-Kalender:
- **Teilnahme Ja / ? Vlt / Nein** je Zeile; „Ja“ übernimmt die Veranstaltung mit Status „Interessiert“ in deine Liste (verknüpfte Events werden nicht dupliziert), „? Vlt“ merkt sie als unentschieden vor (eigener Filter und Zähler, keine Übernahme), „Nein“ räumt automatisch Übernommenes wieder auf.
- **👥-Anzeige:** Bei verknüpften Veranstaltungen zeigt ein Badge, wie viele andere Community-Mitglieder dort bereits als Teilnehmer eingetragen sind (Namen im Tooltip).
- **Kosten** direkt in der Tabelle editierbar – fließen als Ticketpreis in die Übernahme ein.
- **📆-Button** je Zeile trägt den Termin in Google Kalender ein; **„.ics aller Zusagen“** exportiert alle Ja-Termine gesammelt.
- Filter nach Jahr und Entscheidungsstatus; Quelle je Eintrag (📆 Kalender / 🔎 Recherche).

---

## 6. Kosten

Globale Auswertung über alle Veranstaltungen: Gesamt-KPIs, Verteilung nach Kategorie (Eintritt, Fahrtkosten, Übernachtung, Verpflegung, Sonstiges), Einzelposten je Veranstaltung und **CSV-Export** (Semikolon-getrennt, Excel-tauglich). Posten mit „auto“ stammen aus Anmeldung/Reise/Hotel und werden dort bearbeitet.

**Netto / USt / Brutto & Fremdwährung:** Manuelle Kostenposten erfasst du als Bruttobetrag mit **Währung** (EUR, USD, GBP, CHF u. a.) und **USt-Satz** (19/7/0 %). Bei Fremdwährung rechnet die App mit dem **Kurs** in EUR um — der Kurs wird als Richtwert vorbelegt, online automatisch mit dem EZB-Referenzkurs aktualisiert und ist manuell überschreibbar (Beleg-Kurs). Die Live-Vorschau im Formular zeigt Netto + USt = Brutto; die Kostentabellen führen eigene Netto-/USt-/Brutto-Spalten samt Summenzeile, der CSV-Export enthält zusätzlich USt-Satz, Währung, Originalbetrag und Kurs. Hinweis: Bei Auslandsrechnungen mit Reverse-Charge den USt-Satz 0 % wählen.

---

## 7. Community & Nachrichten

Die Community-Ansicht hat oben rechts ein **☰-Menü** mit sechs Bereichen: 👤 Profile & Mitglieder, 🤝 Matching (Suche ↔ Biete), 📅 Meine nächsten Events, 🚘 Mitfahrgelegenheiten, 🍽 Treffen, 💬 Nachrichten.

- **🤝 Matching:** vergleicht automatisch die „Suche“-Felder aller Profile mit den „Biete“-Feldern der anderen und listet Treffer mit den passenden Stichworten und einem ✉-Kontakt-Knopf. Darunter: Mitglieder mit gemeinsamen Interessen. Je konkreter die Profilfelder, desto besser die Treffer.
- **📅 Meine nächsten Events:** anstehende Veranstaltungen, bei denen du Teilnehmer bist oder dein Anmeldestatus Interessiert/Angemeldet/Bezahlt ist — dieselbe Liste erscheint in jeder Profil-Detailansicht.
- **Mitglieder & Kurzprofile:** unter „Community“ anlegen/bearbeiten; zusätzlich registriert jede neue Login-E-Mail automatisch ein Mitglied. Jedes Profil kann enthalten: Wohnort, Firma, Alter, Geschlecht, **Interessen** und **Fähigkeiten** (als Chips), **aktuelles Projekt** sowie **🔎 Suche / 🤝 Biete** für gezieltes Netzwerken auf der Messe. Klick auf eine Profilkarte öffnet die Detailansicht mit „Nachricht senden“.
- **Treffen:** je Veranstaltung planbar (Mittagessen, vor/während der Konferenz, Nachbetrachtung …) mit Zeit, Ort, Teilnehmern – **„Teilnehmen/Absagen“** per Klick.
- **Mitfahrgelegenheiten:** als Fahrer anbieten (Abfahrtsort, Zeit, Plätze); andere steigen mit **„Mitfahren“** ein – die Platzverwaltung zählt mit.
- **Austausch:** Kommentar-Feed je Veranstaltung.
- **💬 Nachrichten:** Direktnachrichten zwischen Mitgliedern mit Ungelesen-Zähler in der Navigation und Lesebestätigung (✓ gesendet / ✓✓ gelesen). Start über den Navigationspunkt oder den ✉-Button bei einem Mitglied.

---

## 8. Materialien & Sharing

- **Notizen:** je Veranstaltung, mit Titel und Änderungszeit — und **🎤 Diktierfunktion**: Im Notiz-Formular auf „Diktieren“ klicken und sprechen (deutsch); der Text erscheint satzweise im Feld (Chrome/Edge, Mikrofon-Freigabe nötig).
- **Präsentationen & Dokumente:** Upload (PDF, PPTX, DOCX …). Jede Datei gehört ihrem Uploader; über 🔗/🔒 schaltest du sie geteilt/privat. Geteilte Dateien sehen nur Mitglieder der **Sharing-Runde** der Veranstaltung („Zum Sharing anmelden“). PDFs haben einen **📖-Knopf**: Die Folien werden direkt in der App durchblätterbar angezeigt (bis 40 Seiten, Anzeige lädt einmalig eine Bibliothek aus dem Netz).
- **Bilder:** Galerie mit Vollbild-Ansicht und **🔎 Texterkennung (OCR)**: Der 🔎-Knopf auf einem Bild erkennt den Folientext (deutsch+englisch; der erste Lauf lädt einmalig Sprachdaten, online nötig). Erkannter Text wird am Bild gespeichert (grüne Markierung), ist über das Suchfeld der Galerie **durchsuchbar** und lässt sich per Klick **als Notiz übernehmen** — so werden abfotografierte Folien wiederauffindbar.

Dateien liegen in der IndexedDB deines Browsers (kein automatischer Cloud-Upload).

---

## 9. Konto, Datenschutz & Sicherheit

Über **⚙ Konto & Daten** (Seitenleiste):
- **📤 Datenexport:** sämtliche App-Daten als JSON (DSGVO Art. 20).
- **🛡 MFA einrichten** (Cloud-Modus): QR-Code mit Authenticator-App scannen, Code bestätigen – ab dann verlangt jeder Login den zweiten Faktor.
- **🗑 Konto löschen:** entfernt dein Profil und alle deine Inhalte (Beiträge, Nachrichten, Mitfahrten, eigene Dateien); im Cloud-Modus zusätzlich das Supabase-Konto (DSGVO Art. 17). Zweifache Sicherheitsabfrage.
- **⚠️ Alle lokalen Daten löschen:** setzt die App in den Auslieferungszustand zurück.

Rechtliche Informationen: „Datenschutz“ und „Impressum / EU AI Act“ unten in der Seitenleiste.

---

## 10. Tipps & Fehlerbehebung

- **Termine der Startdaten** sind recherchierte Werte – vor Buchung immer die verlinkte Veranstalter-Website prüfen (Hinweis in der App).
- **Daten weg nach Browserwechsel?** Lokale Daten gelten pro Browser und Gerät. Für geräteübergreifende Nutzung den Cloud-Modus einrichten (README, Abschnitt Veröffentlichung).
- **Code beim Demo-Login vertippt?** Einfach erneut „Anmelden“ wählen – es wird ein neuer Code erzeugt.
- **Speicherplatz:** Browser begrenzen IndexedDB (meist mehrere GB). Sehr große Videodateien besser extern ablegen und in Notizen verlinken.
- **Backup:** regelmäßig ⚙ → Datenexport nutzen; die JSON-Datei sichert die komplette Planung (ohne Binärdateien).
