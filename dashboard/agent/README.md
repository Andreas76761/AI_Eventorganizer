# HomeLab-Agent – jeden PC über WLAN mit dem Dashboard verbinden

Der Agent ist ein kleiner Dienst (eine einzige Datei, keine npm-Pakete), der auf jedem
deiner 4 PCs läuft. Das Dashboard spricht ihn über das Heimnetz (WLAN/LAN) an und kann
dann je Rechner sehen, welche Apps laufen, und sie **starten/stoppen**.

```
Dashboard (Browser, http://localhost:8950)
    │  WLAN / Heimnetz
    ├── http://192.168.x.11:9800  → Agent auf PC 1
    ├── http://192.168.x.12:9800  → Agent auf PC 2
    ├── http://192.168.x.13:9800  → Agent auf PC 3
    └── http://192.168.x.14:9800  → Agent auf PC 4
```

## Installation je PC (einmalig, ~5 Minuten)

1. **Node.js installieren** (falls nicht vorhanden): https://nodejs.org (LTS)
2. Den Ordner `agent/` auf den PC kopieren, z. B. nach `C:\homelab-agent\`
3. `config.example.json` → als `config.json` speichern und anpassen:
   - `name`: Anzeigename des Rechners (z. B. "Büro-PC")
   - `token`: **eigenes geheimes Passwort** eintragen (auf allen PCs dasselbe oder je PC eines)
4. `apps.example.json` → als `apps.json` speichern: alle Apps **dieses** Rechners eintragen.
   - `id` muss der App-ID im Dashboard entsprechen (steht im JSON-Export)
   - `cmd` = Startkommando, `cwd` = Projektordner, `port` = lokaler Port (für die Läuft-Erkennung)
5. Starten:
   ```
   node agent.js
   ```
   Der Agent zeigt beim Start seine Adresse an, z. B. `http://192.168.178.23:9800`.
6. **Windows-Firewall:** Beim ersten Start fragt Windows nach – Zugriff für **private Netzwerke**
   erlauben. (Alternativ: Eingehende Regel für TCP-Port 9800 anlegen.)
7. Die angezeigte Adresse im Dashboard eintragen: **Rechner → ✎ → Agent-Adresse + Token**.

Die IP-Adresse eines PCs findest du auch mit `ipconfig` (Windows) bzw. `ip a` (Linux).
Tipp: Im Router (z. B. FritzBox) den PCs **feste IP-Adressen** zuweisen, sonst ändern sie sich.

## Autostart (empfohlen)

**Windows – Aufgabenplanung:** Aufgabe „Bei Anmeldung" anlegen mit Programm `node` und
Argument `C:\homelab-agent\agent.js` (Starten in: `C:\homelab-agent`).

**Linux – systemd:** Unit mit `ExecStart=/usr/bin/node /home/du/homelab-agent/agent.js`.

## Endpunkte (für eigene Skripte)

| Endpunkt | Methode | Token | Zweck |
|---|---|---|---|
| `/ping` | GET | nein | Lebenszeichen + Rechnername |
| `/status` | GET | ja | Rechner-Infos, Liste der Apps mit läuft/läuft nicht |
| `/start/<id>` | POST | ja | App aus der Whitelist starten |
| `/stop/<id>` | POST | ja | vom Agent gestartete App stoppen |

Token wird als Header geschickt: `Authorization: Bearer <token>`.

## Sicherheit

- Der Agent startet **ausschließlich**, was in `apps.json` steht — kein freies Ausführen von Kommandos.
- Start/Stopp und Status nur mit Token; `/ping` verrät nur den Namen.
- **Niemals** den Port 9800 im Router ins Internet weiterleiten. Für Zugriff von unterwegs Tailscale o. ä. verwenden.
- Wichtig: Die Steuerung funktioniert aus dem **lokal geöffneten** Dashboard (http://localhost).
  Aus der HTTPS-Vercel-Version blockiert der Browser Anfragen an http://-Adressen im LAN (Mixed Content).
