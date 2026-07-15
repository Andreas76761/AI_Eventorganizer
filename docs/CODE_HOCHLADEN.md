# Code der 4 Apps zu GitHub hochladen (Schritt für Schritt)

**Warum?** Diese vier Apps haben auf GitHub bisher nur eine README-Datei – der eigentliche
Code liegt noch lokal auf deinem PC bzw. in Google AI Studio. Erst wenn der Code auf GitHub
liegt, kann das Dashboard sie analysieren, einen Screenshot machen und bewerten.

Betroffen sind:

| App | Wo liegt der Code? | Repo auf GitHub |
|---|---|---|
| Baudokumentation 2026 V1 | lokal (gebaut mit Claude) | `Andreas76761/baudokumentation2026_V1` |
| Bauplaner Version 1 | lokal (gebaut mit Codex) | `Andreas76761/Bauplaner_Version1` |
| TaxFlow | Google AI Studio | `Andreas76761/TaxFlow` |
| Simulation SC V1 | Google AI Studio | `Andreas76761/Simulation_SC_V1` |

Es gibt zwei Fälle. Suche dir je App den passenden aus.

---

## Fall A: Der Code liegt auf deinem PC (Baudokumentation, Bauplaner)

### Der einfachste Weg: GitHub Desktop (mit Maus, ohne Kommandozeile)

1. **GitHub Desktop installieren:** https://desktop.github.com → herunterladen, installieren,
   mit deinem GitHub-Konto anmelden (andreas76761).
2. Oben links **File → Add local repository**.
3. Auf **Choose…** klicken und den Ordner der App auswählen (z. B. `C:\2026\Claude\Baudokumentation`).
4. Erscheint „This directory does not appear to be a Git repository", klicke auf
   **create a repository** (den blauen Link). Im nächsten Fenster unten **Create repository**.
5. Links siehst du jetzt alle Dateien. Unten links ein **Summary** eintippen (z. B. „Erste Version")
   und auf **Commit to main** klicken.
6. Oben auf **Publish repository**. Wichtig: Im Feld **Name** exakt den vorhandenen Repo-Namen
   eintragen (z. B. `baudokumentation2026_V1`), Haken bei „Keep this code private" nach Wunsch,
   dann **Publish repository**.
   - Falls „a repository with this name already exists": nimm stattdessen oben **Repository →
     Repository settings → Remote** und trage als URL
     `https://github.com/Andreas76761/baudokumentation2026_V1.git` ein, dann **Push origin**.
7. Fertig – der Code ist auf GitHub. 🎉

### Alternative: Kommandozeile (falls du sie schon nutzt)

Eingabeaufforderung im App-Ordner öffnen (im Datei-Explorer in die Adresszeile `cmd` tippen + Enter):

```
git init
git add .
git commit -m "Erste Version"
git branch -M main
git remote add origin https://github.com/Andreas76761/baudokumentation2026_V1.git
git push -u origin main
```

Meldet Git „remote origin already exists", überspringe die `git remote add`-Zeile.
Meldet der Push einen Konflikt („rejected"), hänge einmalig `--force` an die letzte Zeile:
`git push -u origin main --force` (überschreibt die reine README auf GitHub – bei diesen
Repos unkritisch, weil dort ja nur die README liegt).

Für den **Bauplaner** dasselbe, nur mit der URL
`https://github.com/Andreas76761/Bauplaner_Version1.git`.

---

## Fall B: Die App liegt in Google AI Studio (TaxFlow, Simulation SC)

AI-Studio-Apps kannst du direkt aus AI Studio auf GitHub schieben oder als ZIP herunterladen.

### Weg 1: direkt aus AI Studio (am einfachsten)

1. https://aistudio.google.com/apps öffnen und die App (z. B. TaxFlow) auswählen.
2. Oben rechts das GitHub-Symbol bzw. **… → Push to GitHub / Export to GitHub** anklicken.
3. Als Ziel-Repository das bestehende auswählen (`Andreas76761/TaxFlow`) und bestätigen.
4. Fertig – AI Studio lädt den Code hoch.

### Weg 2: ZIP herunterladen und mit GitHub Desktop hochladen

1. In AI Studio **… → Download / Export code** → ZIP speichern und entpacken.
2. Dann exakt wie **Fall A / GitHub Desktop** ab Schritt 2 mit dem entpackten Ordner vorgehen,
   Repo-Name `TaxFlow` bzw. `Simulation_SC_V1`.

---

## Und dann?

Sag mir kurz Bescheid, wenn eine App hochgeladen ist (oder alle vier). Ich hole den Code dann in
die Session, analysiere die App, baue sie (Screenshot), messe die Performance und trage Technologie,
Umfang, Bewertung und Verbesserungsvorschläge automatisch ins Dashboard ein – so wie bei den anderen
sieben Apps.

## Sonderfall Paperclip Bau

Das Repo `Paperclip_Bau` ist komplett leer (kein einziger Commit). Falls die App lokal existiert:
genauso wie Fall A hochladen. Falls es das Repo aus Versehen gibt: auf GitHub unter
**Settings → Danger Zone → Delete this repository** löschen und im Dashboard über ✎ entfernen.
