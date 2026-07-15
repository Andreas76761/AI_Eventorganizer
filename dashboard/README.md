# HomeLab App-Dashboard (Phase 1)

Grafische Übersicht und Verwaltung aller selbstgebauten Apps im Heimnetz — siehe [Vorgehensplan](../docs/APP_DASHBOARD_VORGEHEN.md).

## Starten

Rein statisch, kein Build nötig:

```
python -m http.server 8950 --directory dashboard
```

Dann http://localhost:8950 öffnen. (Direktes Öffnen von `index.html` per Doppelklick funktioniert ebenfalls.)

## Ansichten

- **Übersicht** – alle Apps als Karten mit Volltextsuche und Filtern (Werkzeug, Rechner, Hosting, Status)
- **Nach Werkzeug** – Gruppierung nach Claude, Codex, OpenAI, Perplexity, Lovable, Gemini, Sonstiges
- **Rechner** – die 4 PCs im Heimnetz mit ihren zugeordneten Apps (Namen/Details editierbar)
- **GitHub & Vercel** – Tabelle aller Repos und Deployments mit Live-Erreichbarkeitsprüfung („⟳ Alle prüfen")
- **Daten** – JSON-Export/-Import, Zurücksetzen auf Startdaten

## Daten

- Startdaten in `js/registry.js` (11 GitHub-Repos, Stand 2026-07-15); **Vercel-URLs sind vermutet**, bis die
  Prüfung im Browser sie bestätigt (grüner Punkt)
- Alle Änderungen (Apps ergänzen/bearbeiten, PC-Namen, Werkzeug-Zuordnung) liegen im LocalStorage des Browsers
- Unter „Daten" als `homelab-apps.json` exportieren — diese Datei kann später als gepflegte Registry ins Repo
  übernommen werden

## PCs über WLAN verbinden (Agent)

Im Ordner [`agent/`](agent/) liegt der **HomeLab-Agent**: eine einzelne Node.js-Datei ohne
Abhängigkeiten, die auf jedem PC läuft und ihn über das Heimnetz mit dem Dashboard verbindet —
Status je App (läuft/läuft nicht) und **Start/Stopp direkt aus dem Dashboard**. Installation und
Sicherheit: siehe [agent/README.md](agent/README.md). Agent-Adresse + Token trägt man je Rechner
unter „Rechner → ✎" ein; „⟳ Alle Rechner verbinden" holt den Live-Status.

## Nächste Phasen

Phase 2 Bewertung/Vergleich · Phase 3 GitHub-/Vercel-API-Status (siehe Plan).
