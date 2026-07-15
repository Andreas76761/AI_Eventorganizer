# Vorgehensplan: HomeLab App-Dashboard

Zentrale grafische Oberfläche zur Verwaltung von ~20 selbstgebauten Apps auf 4 Rechnern im Heimnetz plus Cloud-Deployments (GitHub, Vercel). Erstellt mit unterschiedlichen Technologien (Claude, Codex/OpenAI, Perplexity, Lovable u. a.).

## 1. Ziele

1. **Übersicht** – alle Apps auf einen Blick: Karte je App mit Name, Zweck, Screenshot, Status
2. **Ursprung & Technologie** – womit gebaut (Claude, Codex, Lovable …), welcher Stack (React, Python, statisch …), wo gehostet (lokaler Rechner, LAN, GitHub, Vercel)
3. **Suche & Filter** – nach Name, Technologie, Ursprung, Host, Status, Tags, Bewertung
4. **Technologische Bewertung** – Kriterien-Scoring je App (Reifegrad, Nutzen, Wartbarkeit …), Vergleichsansicht
5. **Steuerung aus der App heraus** – öffnen, starten/stoppen (lokale Apps), Deployment-Status und Redeploy (Vercel), Repo/Commits/Actions (GitHub)

## 2. Grundsatzentscheidung: Eigenbau vs. Fertiglösung

| Option | Stärken | Schwächen |
|---|---|---|
| **Homarr / Dashy / Homer** (fertige Homelab-Dashboards) | sofort nutzbar, Status-Pings, hübsche Kacheln | keine eigene Bewertungslogik, kein „womit gebaut“-Datenmodell, GitHub/Vercel-Integration begrenzt |
| **Uptime Kuma** | sehr gutes Monitoring | nur Monitoring, keine Verwaltung/Bewertung |
| **Eigenbau (empfohlen)** | Datenmodell exakt passend (Ursprung, Bewertung, Steuerung), gleicher Stack wie AI Messe Guide → wiederverwendbares Know-how | Aufwand, Monitoring selbst bauen |

**Empfehlung:** Eigenbau als statisches Frontend (wie der AI Messe Guide: HTML/CSS/JS, Vercel-Deploy, optional Supabase-Sync) **plus** ein kleiner „Agent“-Dienst pro Rechner für Status und Start/Stop. Uptime Kuma kann optional parallel laufen, ersetzt aber nicht das Verwaltungs-Frontend.

## 3. Architektur

```
┌─────────────────────────────────────────────────────┐
│  Dashboard-Frontend (statisch, Vercel + lokal)      │
│  apps.json (Registry) · Suche/Filter · Bewertung    │
└──────┬───────────────┬───────────────┬──────────────┘
       │               │               │
   GitHub API      Vercel API     Agent je Rechner (4×)
   (Repos,         (Deployments,  Node/Express, Port 9800
   Commits,        Redeploy)      /status /start /stop
   Actions)                       (Token, nur LAN)
```

- **Registry `apps.json`** – versioniert im Repo, eine Datei als „Single Source of Truth“ für alle 20 Apps
- **Frontend** – rein statisch, läuft lokal (`python -m http.server`) und auf Vercel; Design-/Icon-System aus dem AI Messe Guide wiederverwenden
- **Agents** – ein kleiner Node-Dienst pro Rechner (Autostart), der nur **whitelisted** Kommandos ausführt; Zugriff nur im LAN mit Token
- **Cloud-APIs** – GitHub (PAT, read-only reicht anfangs) und Vercel (Token) direkt vom Frontend oder über den Agent als Proxy (umgeht CORS)

## 4. Datenmodell (Registry-Eintrag)

```json
{
  "id": "ai-messe-guide",
  "name": "AI Messe Guide 2026",
  "beschreibung": "Verwaltung von AI-Messen und -Events",
  "ursprung": ["Claude"],
  "stack": ["HTML/JS statisch", "Supabase", "PWA"],
  "hosting": { "typ": "vercel", "url": "https://ai-messe-guide.vercel.app" },
  "lokal": { "rechner": "PC1", "pfad": "C:/2026/Claude/AI_Messe_Guide", "port": 8933,
             "startCmd": "python -m http.server 8933" },
  "repo": "https://github.com/Andreas76761/AI_Eventorganizer",
  "vercelProjekt": "ai-messe-guide",
  "tags": ["produktiv", "events", "pwa"],
  "bewertung": { "nutzen": 5, "reifegrad": 4, "wartbarkeit": 4, "techQualitaet": 4, "notiz": "" },
  "status": "aktiv"
}
```

Felder für Filter/Suche: `ursprung`, `stack`, `hosting.typ`, `lokal.rechner`, `tags`, `status`, `bewertung.*`.

## 5. Phasenplan

### Phase 1 – MVP: Katalog & Übersicht (1–2 Tage)
- `apps.json` mit allen 20 Apps befüllen (einmalige Inventur: Name, Ursprung, Stack, URLs, Rechner, Repo)
- Frontend: Kachel-/Listenansicht, Detailpanel je App, Volltextsuche, Filter-Chips (Ursprung, Rechner, Hosting, Tags, Status)
- „Öffnen“-Button je App (URL lokal/Vercel), Repo-Link
- Deploy auf Vercel + lokal lauffähig
- **Ergebnis: sofort nutzbare Übersicht — der größte Nutzen für den kleinsten Aufwand**

### Phase 2 – Bewertung & Vergleich (1 Tag)
- Bewertungs-Editor je App (1–5 ★ je Kriterium: Nutzen, Reifegrad, Wartbarkeit, Tech-Qualität, Zukunftsfähigkeit)
- Gesamt-Score, sortierbare Vergleichstabelle, Statistik (Apps je Ursprung/Stack/Rechner, Score-Verteilung)
- Änderungen als JSON exportieren/zurück in die Registry mergen (wie Event-Paket im Messe Guide); optional Supabase-Sync

### Phase 3 – Status-Monitoring (1–2 Tage)
- Erreichbarkeits-Check je App: Vercel-/LAN-URLs per `fetch` (HEAD, `no-cors` als Fallback) mit Ampel 🟢🟡🔴
- GitHub-Integration (PAT): letzter Commit, offene Issues, Actions-Status je Repo
- Vercel-Integration (Token): letztes Deployment, Status, Preview-URLs
- Auto-Refresh-Intervall, „zuletzt geprüft“-Zeitstempel

### Phase 4 – Steuerung: Agents (2–3 Tage)
- Node/Express-Agent (~100 Zeilen) je Rechner: `GET /status` (welche Ports/Prozesse laufen), `POST /start/:id`, `POST /stop/:id` — Kommandos ausschließlich aus einer lokalen Whitelist-Datei je Rechner, Bearer-Token, Bindung an LAN-Interface
- Autostart (Windows: Aufgabenplanung / NSSM; Linux: systemd)
- Frontend: Start/Stop-Buttons erscheinen, wenn der Agent des Rechners erreichbar ist
- Vercel-Redeploy-Button (Deploy-Hook-URL je Projekt — einfach und ohne API-Schreibrechte)

### Phase 5 – Komfort (optional, fortlaufend)
- Screenshots je App (in IndexedDB wie beim Messe Guide oder als Dateien im Repo)
- Changelog/Notizen je App, „zuletzt benutzt“
- Gruppierung nach Rechner mit Netzwerk-Ansicht (4 Rechner als Karte)
- Zugriff von unterwegs: Tailscale (empfohlen) statt Portfreigaben

## 6. Sicherheit

- Agents **niemals** ins Internet exponieren: nur LAN-Bindung, Bearer-Token, Kommando-Whitelist (kein freies `exec`)
- GitHub-PAT und Vercel-Token nicht ins Repo: wie beim Messe Guide eine gitignorte `config.js` (Vorlage `config.example.js`)
- Öffentliche Vercel-Instanz des Dashboards zeigt ohne Tokens nur den statischen Katalog — Steuerung funktioniert nur im Heimnetz

## 7. Projektstruktur (neues Repo empfohlen, z. B. `homelab-dashboard`)

```
index.html          – Shell mit Sidebar (Übersicht, Vergleich, Rechner, Einstellungen)
apps.json           – Registry aller 20 Apps
js/app.js           – Zustand, Ansichten, Suche/Filter
js/registry.js      – Laden/Validieren/Mergen der Registry
js/integrations.js  – GitHub-, Vercel-, Agent-Aufrufe
js/config.example.js – Tokens, Agent-Adressen (echte config.js gitignored)
css/                – Design-System vom AI Messe Guide übernommen
agent/agent.js      – der Node-Agent (identisch auf alle 4 Rechner kopieren)
agent/whitelist.example.json – erlaubte Start/Stop-Kommandos je Rechner
```

## 8. Nächste Schritte

1. **Inventur** (wichtigster Schritt, ohne Code): Tabelle aller 20 Apps mit Name, Rechner, Ursprung, Stack, URL, Repo, Startkommando → wird direkt zu `apps.json`
2. Neues Repo `homelab-dashboard` anlegen (oder Unterordner hier — Empfehlung: eigenes Repo, da eigenständiges Produkt mit eigenem Vercel-Projekt)
3. Phase 1 umsetzen und deployen
4. Danach Phasen 2–4 nacheinander; jede Phase liefert einen nutzbaren Zwischenstand
