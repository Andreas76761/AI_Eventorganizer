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

## Installation je PC: EINE Datei (einmalig, ~3 Minuten)

Es wird nur **`homelab-agent.js`** benötigt — Einrichtungs-Assistent, Agent und
Autostart-Einrichtung stecken in dieser einen Datei (keine npm-Pakete).

1. **Node.js installieren** (falls nicht vorhanden): https://nodejs.org (LTS)
2. `homelab-agent.js` auf den PC kopieren, z. B. nach `C:\homelab-agent\`
   (optional dazu `Agent-starten.bat` für den Doppelklick-Start)
3. Starten — beim **ersten Start** fragt der Assistent PC-Name, Port und Token ab
   und legt `config.json` + `apps.json` (Vorlage) automatisch an:
   ```
   node homelab-agent.js
   ```
   Am Ende zeigt er genau an, was im Dashboard einzutragen ist
   (z. B. `Agent-Adresse: http://192.168.178.23:9800` + Token).
4. `apps.json` öffnen und die Vorlage durch die Apps **dieses** Rechners ersetzen:
   - `id` muss der App-ID im Dashboard entsprechen (steht im JSON-Export)
   - `cmd` = Startkommando, `cwd` = Projektordner, `port` = lokaler Port (für die Läuft-Erkennung)
   - Einträge mit `"_hinweis"` sind nur Vorlagen und werden ignoriert
5. **Windows-Firewall:** Beim ersten Start fragt Windows nach – Zugriff für **private Netzwerke**
   erlauben. (Alternativ: Eingehende Regel für TCP-Port 9800 anlegen.)
6. Die angezeigte Adresse im Dashboard eintragen: **Rechner → ✎ → Agent-Adresse + Token**.

Einrichtung wiederholen: `config.json` löschen und neu starten.
Die IP-Adresse eines PCs findest du auch mit `ipconfig` (Windows) bzw. `ip a` (Linux).
Tipp: Im Router (z. B. FritzBox) den PCs **feste IP-Adressen** zuweisen, sonst ändern sie sich.

## Autostart (empfohlen)

**Windows:** Eingabeaufforderung als Administrator, dann
```
node homelab-agent.js --autostart
```
Das legt die Aufgabe „HomeLab-Agent" (bei Anmeldung) in der Aufgabenplanung an.
Entfernen: `schtasks /Delete /TN "HomeLab-Agent" /F`

**Linux – systemd:** Unit mit `ExecStart=/usr/bin/node /home/du/homelab-agent/homelab-agent.js`.

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
