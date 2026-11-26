# -*- coding: utf-8 -*-
"""Erzeugt Insight-Radar-Datensätze (Format trendradar-export/1) aus Event-Archiven.

Quelle sind die veröffentlichten Programme (data/<ev>-archiv.json) – keine Transkripte.
Daher gilt für alle Signale: Evidenzgrad "Behauptung", Zitat = Originaltitel bzw.
Original-Inhaltsbeschreibung, Codierung regelbasiert über Schlüsselwörter, Rollen
heuristisch aus Firmennamen. Das Methodenblatt im Export deklariert diese Grenzen.

Aufruf:  python scripts/radar-generator.py          (erzeugt WAD26 + E9-26)
"""
import json, re, sys, datetime, unicodedata
from pathlib import Path

BASIS = Path(__file__).resolve().parent.parent
HEUTE = datetime.date.today().isoformat()

# ---------------------------------------------------------------- Rollen-Heuristik
ROLLEN_REGELN = [
    ("Forschung", r"universit|university|hochschul|fraunhofer|institut|\bETH\b|\bHPI\b|\bDLR\b|max.planck|\bTU\b|\bLMU\b|helmholtz|research"),
    ("Politik/Aufsicht/Regulierer", r"minister|bundes|staats|government|beh[öo]rde|landeshauptstadt|patent office|employment|agentur f|federal|senat"),
    ("Investor", r"ventures|capital\b|\bfund\b|\bVC\b|invest"),
    ("Medien", r"\bzeit\b|rundfunk|s[üu]ddeutsche|magazin|verlag|tagesspiegel|media\b|krautreporter|journalis"),
    ("Berater/Dienstleister", r"consult|beratung|mckinsey|accenture|capgemini|\bTNG\b|codecentric|thinktecture|4tecture|wavestone|sopra|eficode|pythian|globant|SQUER|inovex|EPAM"),
    ("Verband/Community", r"bitkom|verband|foundation|\be\.? ?V\.?\b|community|board\b|testing board|denkfabrik|eclipse"),
    ("Anbieter etabliert", r"nvidia|microsoft|google|\bSAP\b|\bIBM\b|amazon|\bAWS\b|adobe|salesforce|atlassian|qualcomm|broadcom|jetbrains|github|gitlab|snowflake|databricks|mongodb|canonical|cloudflare|vercel|netlify|sentry|dynatrace|infineon|siemens|bosch|intel|mastercard|docker|oracle|red ?hat|varnish|tomtom|zeiss|azul"),
    ("Anwender", r"mercedes|adidas|allianz|\bING\b|deutsche bank|\bRWE\b|e\.on|zalando|delivery hero|hellofresh|miro|booking|trade republic|picnic|lego|ericsson|disney|netflix|king\b|wolt|zooplus|otto|klm|lufthansa|bank|versicherung|techniker|aldi|schwarz|enpal|flink|tui\b|justeat|payoneer|bol\b|clue\b|egym|jobrad|kiwi|mbank|riverty|sofascore"),
]
def rolle_fuer_firma(firma):
    f = (firma or "").strip()
    if not f: return "unbekannt"
    for rolle, rx in ROLLEN_REGELN:
        if re.search(rx, f, re.I): return rolle
    if re.search(r"\.ai\b|\bAI\b|labs\b|robotics|quantum|deeptech", f, re.I): return "Anbieter Startup"
    return "unbekannt"

# ---------------------------------------------------------------- Gewichte (wie AIW-Export)
W_EVIDENZ = {"gemessen": 1.0, "zitiert": 0.8, "Erfahrung": 0.6, "Behauptung": 0.3}
W_BEITRAG = {"Praxisbericht": 1.0, "Studie/Daten": 0.9, "Methodik/Framework": 0.8,
             "Regulierung/Rahmen": 0.8, "Ausblick/These": 0.6, "Produkt/Lösung": 0.5}
W_EIGEN = {"nein": 1.0, "teilweise": 0.8, "ja": 0.6, "unbekannt": 0.8}
DIMENSIONEN = [{"id": "A", "name": "Wert & Geschäft"}, {"id": "B", "name": "Organisation & Mensch"},
               {"id": "C", "name": "Governance & Risiko"}, {"id": "D", "name": "Technik & Engineering"},
               {"id": "E", "name": "Markt, Standort & Rahmen"}]
STEEP = ["Social", "Technological", "Economic", "Environmental", "Political"]
ENUM = {"rolle": [r for r, _ in ROLLEN_REGELN] + ["Anbieter Startup", "Anwender", "Moderation/Veranstalter", "unbekannt"],
        "typ": ["these", "zahl", "framework", "gegenposition", "beobachtung"],
        "beitragsart": list(W_BEITRAG.keys()), "evidenzgrad": list(W_EVIDENZ.keys()),
        "eigeninteresse": list(W_EIGEN.keys())}
ENUM["rolle"] = sorted(set(ENUM["rolle"]))

LOGISTIK = r"check.?in|badge|doors open|party|karaoke|booth crawl|pause|registrierung|get.?together|warm.?up|einlass"

def beitragsart_fuer(format_, titel):
    t = (format_ or "") + " " + (titel or "")
    if re.search(r"workshop|masterclass|hands.?on|bootcamp|tutorial", t, re.I): return "Methodik/Framework"
    if re.search(r"studie|study|research|forschung|science|report\b", t, re.I): return "Studie/Daten"
    if re.search(r"demo|launch|produkt|product|showcase|exhibition", t, re.I): return "Produkt/Lösung"
    if re.search(r"regul|act\b|gesetz|compliance|policy", t, re.I): return "Regulierung/Rahmen"
    if re.search(r"lessons|learnings|case|praxis|wie wir|how we|erfahrung", t, re.I): return "Praxisbericht"
    return "Ausblick/These"

def erster_satz(text, max_len=240):
    s = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    erg = s[0] if s and s[0] else ""
    return (erg[: max_len - 1] + "…") if len(erg) > max_len else erg

# ---------------------------------------------------------------- Kern: Radar bauen
def baue_radar(cfg):
    archiv = json.load(open(BASIS / "data" / cfg["archiv"], encoding="utf-8"))
    jahr = next(j for j in archiv["jahre"] if str(j["jahr"]) == str(cfg["jahr"]))
    speaker_db = {s["name"].strip().lower(): s for s in jahr.get("speaker", [])}
    ev = cfg["event_id"]

    sessions, signale, uncodiert = [], [], 0
    quellen_z = 0
    for i, p in enumerate(jahr["programm"]):
        titel = (p.get("titel") or "").strip()
        if not titel or re.search(LOGISTIK, titel, re.I):
            continue
        sid = f"P-{i+1:03d}"
        # Rollen der Session aus Speaker-Firmen
        rollen = set()
        for name in re.split(r"[;+/]| und ", p.get("speaker") or ""):
            sp = speaker_db.get(name.strip().lower())
            if sp: rollen.add(rolle_fuer_firma(sp.get("firma")))
        if not rollen: rollen = {"unbekannt"}
        sessions.append({
            "id": sid, "event": ev, "titel": titel, "typ": "vortrag",
            "format": p.get("format") or p.get("track") or "Session",
            "tag": p.get("tag") or "", "track": p.get("track") or p.get("buehne") or "",
            "start": f'{p.get("datum","")} {p.get("start","")}'.strip(),
            "erfassung": "programm", "dublette_von": None, "hinweis": None,
            "rollen": sorted(rollen), "zaehleinheit": sid,
            "meta": {"titel": {"wert": titel, "herkunft": "agenda", "sicherheit": "hoch", "beleg": "Programm"}},
        })
        # Codierung: Keyword-Treffer über Titel + Track + Inhalt
        text = " ".join([titel, p.get("track") or "", p.get("inhalt") or ""])
        treffer = []
        for code in cfg["mikro"]:
            punkte = sum(1 for rx in code["kw"] if re.search(rx, text, re.I))
            if punkte: treffer.append((punkte, code["id"]))
        treffer.sort(key=lambda t: -t[0])
        if not treffer:
            fallback = cfg["track_default"].get(p.get("track") or "")
            if fallback: treffer = [(1, fallback)]
        if not treffer:
            uncodiert += 1
            continue
        codes = [{"id": treffer[0][1], "gewicht": "primaer"}] + \
                [{"id": cid, "gewicht": "sekundaer"} for _, cid in treffer[1:3]]
        inhalt = (p.get("inhalt") or "").strip()
        beitragsart = beitragsart_fuer(p.get("format"), titel)
        gewicht = round(W_EVIDENZ["Behauptung"] * W_BEITRAG[beitragsart] * W_EIGEN["unbekannt"], 3)
        quellen_z += 1
        signale.append({
            "id": f"{sid}-S01", "session": sid,
            "aussage": titel,
            "typ": "beobachtung",
            "zitat": erster_satz(inhalt) if inhalt else titel,
            "paraphrase": False,
            "fundstelle": f'Programm · {p.get("tag","")} {p.get("start","")} · {p.get("buehne","")}'.strip(),
            "link": cfg["programm_url"], "link_stufe": "event",
            "quelle_text": f'{ev} · Programm · {titel}',
            "suchbegriff": titel[:60], "sprecher": (p.get("speaker") or "").split(";")[0].strip() or None,
            "beitragsart": beitragsart, "evidenz": "Behauptung", "eigeninteresse": "unbekannt",
            "unsicher": False, "gewicht": gewicht, "codes": codes, "offen": False,
        })

    # ---------------- Aggregation je Code
    sess_by_id = {s["id"]: s for s in sessions}
    def agg(code_ids):
        sig = [g for g in signale if any(c["id"] in code_ids for c in g["codes"])]
        sess = {g["session"] for g in sig}
        rollen = set()
        for s in sess: rollen.update(sess_by_id[s]["rollen"])
        score = 0.0
        pro_session = {}
        for g in sig:
            f = 1.0 if any(c["id"] in code_ids and c["gewicht"] == "primaer" for c in g["codes"]) else 0.5
            pro_session[g["session"]] = min(2.0, pro_session.get(g["session"], 0) + g["gewicht"] * f)
        score = sum(pro_session.values()) + 0.1 * max(0, len(rollen - {"unbekannt"}) - 1)
        return sig, sess, rollen, round(score, 2)

    n_zaehl = len(sessions)
    mikro_min = max(3, round(0.03 * n_zaehl))
    mikro_out = []
    for m in cfg["mikro"]:
        sig, sess, rollen, score = agg({m["id"]})
        mikro_out.append({
            "code_id": m["id"], "ebene": "mikro", "parent_id": m["parent"], "name": m["name"],
            "definition": m["def"], "abgrenzung": None,
            "ankerbeispiel_signal": sig[0]["id"] if sig else None,
            "dimension": m["dim"], "steep": m["steep"], "seit_event": ev, "version": 1,
            "n_signale": len(sig), "n_sessions": len(sess), "n_events": 1,
            "n_rollen": len(rollen - {"unbekannt"}), "rollen": sorted(rollen),
            "score": score, "sessions_je_event": {ev: len(sess)},
            "anteil_rolle_unbekannt": round(sum(1 for s in sess if sess_by_id[s]["rollen"] == ["unbekannt"]) / len(sess), 3) if sess else 0,
            "ist_trend": len(sess) >= mikro_min, "ring": None, "momentum": None,
        })
    makro_out = []
    for k in cfg["makro"]:
        kinder = [m["id"] for m in cfg["mikro"] if m["parent"] == k["id"]]
        sig, sess, rollen, score = agg(set(kinder))
        makro_out.append({
            "code_id": k["id"], "ebene": "makro", "parent_id": None, "name": k["name"],
            "definition": k["def"], "abgrenzung": None, "ankerbeispiel_signal": None,
            "dimension": k["dim"], "steep": k["steep"], "seit_event": ev, "version": 1,
            "n_signale": len(sig), "n_sessions": len(sess), "n_events": 1,
            "n_rollen": len(rollen - {"unbekannt"}), "rollen": sorted(rollen),
            "score": score, "sessions_je_event": {ev: len(sess)},
            "anteil_rolle_unbekannt": 0.0,
            "n_mikrotrends": sum(1 for m in mikro_out if m["parent_id"] == k["id"] and m["ist_trend"]),
            "ist_trend": len(sess) >= mikro_min, "ring": None, "momentum": None,
        })
    # Ringe: Terzile über Scores der Trends je Ebene
    for liste in (makro_out, mikro_out):
        tr = sorted([c["score"] for c in liste if c["ist_trend"]], reverse=True)
        if tr:
            s1 = tr[max(0, len(tr) // 3 - 1)]; s2 = tr[max(0, 2 * len(tr) // 3 - 1)]
            for c in liste:
                c["ring"] = None if not c["ist_trend"] else ("stark" if c["score"] >= s1 else "mittel" if c["score"] >= s2 else "schwach")

    rollen_mix = {}
    for s in sessions:
        for r in s["rollen"]: rollen_mix[r] = rollen_mix.get(r, 0) + 1
    unbekannt_anteil = round(rollen_mix.get("unbekannt", 0) / max(1, len(sessions)), 3)

    out = {
        "format": "trendradar-export/1",
        "export_id": f"radar-{ev.lower()}-{HEUTE}",
        "stand": HEUTE, "umfang": [ev], "codebuch_version": 1,
        "titel": cfg["titel"], "viewer_url": None,
        "events": [{"event_id": ev, "kuerzel": ev, "name": cfg["name"],
                    "datum_von": cfg["von"], "datum_bis": cfg["bis"], "ort": cfg["ort"],
                    "quelle_agenda": cfg["archiv"], "url": cfg["programm_url"],
                    "meta": {"name": {"wert": cfg["name"], "herkunft": "agenda", "sicherheit": "hoch"}}}],
        "parameter": {"mikro_min_sessions": str(mikro_min), "mikro_min_rollen": "1",
                      "rollen_unbekannt_max": "1.0", "makro_min_mikro": "1", "makro_min_sessions": str(mikro_min),
                      "neuer_code_min_signale": "1", "w_evidenz": W_EVIDENZ, "w_beitragsart": W_BEITRAG,
                      "w_eigeninteresse": W_EIGEN, "score_deckel_session": "2.0", "w_sekundaer": "0.5",
                      "vielfalt_bonus": "0.1", "ring_methode": "terzile", "ring_schwellen": {},
                      "momentum_toleranz": "0.25", "dimension_set": "standard",
                      "mikro_min_sessions_anteil": "0.03", "makro_min_sessions_anteil": "0"},
        "dimensionen": DIMENSIONEN, "steep": STEEP, "enum": ENUM,
        "makro": makro_out, "mikro": mikro_out, "sessions": sessions, "signale": signale,
        "methodenblatt": {
            "quellen": {"programm": len(sessions)}, "erfassung": {"programm": len(sessions)},
            "metadaten_herkunft": {"Titel": {"agenda": len(sessions)}, "Speaker": {"agenda": len(sessions)}},
            "absender_mix": rollen_mix, "n_sessions": len(sessions), "n_signale": len(signale),
            "paraphrasen": 0, "offen": 0, "uncodiert": uncodiert,
            "modelle": {"regelbasiert (Schlüsselwort-Codierung)": len(signale)},
            "rollenkriterium_aktiv": False, "anteil_rolle_unbekannt": unbekannt_anteil,
            "verzerrungen": [
                "Datengrundlage ist das veröffentlichte Programm (Titel" + (", Inhaltsbeschreibungen" if cfg.get("mit_inhalt") else "") + ") – keine Transkripte. Evidenzgrad daher durchgehend 'Behauptung'.",
                "Jede Session liefert genau ein Signal; Belegstärke misst Programm-Präsenz eines Themas, nicht Aussagenvielfalt.",
                "Codierung regelbasiert über Schlüsselwörter (Taxonomie redaktionell erstellt), Rollen heuristisch aus Firmennamen – Anteil 'unbekannt': " + str(round(unbekannt_anteil * 100)) + "%.",
            ],
            "codebuch_versionen": [{"version": 1, "datum": HEUTE, "event_id": ev,
                                    "aenderungen": "Erstfassung (redaktionell) aus dem " + cfg["name"] + "-Programm"}],
            "agenda": {ev: True},
            "markdown": f"# Methodik {cfg['name']}\n\nRadar aus dem veröffentlichten Programm ({len(sessions)} Sessions, {len(signale)} Signale). Signal = Programmpunkt; Zitat = Originaltitel bzw. Original-Inhaltsbeschreibung. Codierung regelbasiert (Schlüsselwörter), Taxonomie redaktionell. Keine Transkripte – Belegstärke = Programm-Präsenz.",
        },
        "schwellen_effektiv": {"mikro_min_sessions": mikro_min, "makro_min_sessions": mikro_min, "zaehleinheiten": n_zaehl},
    }
    ziel = BASIS / "data" / cfg["datei"]
    json.dump(out, open(ziel, "w", encoding="utf-8"), ensure_ascii=False)
    tr_m = sum(1 for m in mikro_out if m["ist_trend"]); tr_k = sum(1 for k in makro_out if k["ist_trend"])
    print(f'{ev}: {len(sessions)} Sessions | {len(signale)} Signale | {uncodiert} uncodiert | '
          f'{tr_k}/{len(makro_out)} Makro- & {tr_m}/{len(mikro_out)} Mikrotrends | Schwelle {mikro_min} | -> {ziel.name}')
    for m in sorted(mikro_out, key=lambda x: -x["n_sessions"])[:6]:
        print(f'   top: {m["code_id"]} {m["name"]}: {m["n_sessions"]} Sessions')
    return out

# ---------------------------------------------------------------- Taxonomien
def M(id_, parent, name, def_, dim, steep, kw): return {"id": id_, "parent": parent, "name": name, "def": def_, "dim": dim, "steep": steep, "kw": kw}
def K(id_, name, def_, dim, steep): return {"id": id_, "name": name, "def": def_, "dim": dim, "steep": steep}

WAD = {
    "event_id": "WAD26", "archiv": "wad-archiv.json", "jahr": 2026, "datei": "radar-wad26.json",
    "titel": "Insight Radar · WeAreDevelopers World Congress 2026",
    "name": "WeAreDevelopers World Congress 2026", "von": "2026-07-08", "bis": "2026-07-10",
    "ort": "Berlin", "programm_url": "https://www.wearedevelopers.com/world-congress/agenda",
    "mit_inhalt": False,
    "makro": [
        K("K-01", "Agentische Softwareentwicklung", "KI-Agenten übernehmen Aufgaben im gesamten Software-Lebenszyklus – vom Coding über Betrieb bis zu agentischen Produkten.", "D", "Technological"),
        K("K-02", "KI-Engineering & Infrastruktur", "Produktionsreife von KI-Systemen: Retrieval, Inferenz, Kosten, GPU-/Edge-Infrastruktur, Physical AI.", "D", "Technological"),
        K("K-03", "Security im KI-Zeitalter", "Neue Angriffsflächen durch KI, Post-Quantum-Vorsorge, Lieferketten-Compliance und Identität.", "C", "Technological"),
        K("K-04", "Sprachen, Architektur & Qualität", "Modernisierung etablierter Plattformen, Architektur-Konsolidierung und Qualitätssicherung.", "D", "Technological"),
        K("K-05", "Web & Developer Experience", "Die Web-Plattform nach den Framework-Kriegen: KI im Browser, DX, Accessibility.", "D", "Technological"),
        K("K-06", "Organisation, Talent & Kultur", "Reskilling, KI im Org-Chart, Leadership-Metriken und Entwickler-Identität.", "B", "Social"),
        K("K-07", "Europas Souveränität & Strategie", "Digitale Souveränität, Confidential Computing, Europas KI-Moment und Nachhaltigkeit.", "E", "Political"),
    ],
    "mikro": [
        M("M-101", "K-01", "Agenten in Produktion", "Betrieb, Orchestrierung und Härtung von KI-Agenten in realen Systemen.", "D", "Technological", [r"agent", r"agentic", r"multi.agent"]),
        M("M-102", "K-01", "MCP & Agent-Protokolle", "MCP und verwandte Protokolle als Schnittstellen-Standard für Agenten.", "D", "Technological", [r"\bMCP\b", r"protocol", r"interface layer", r"trust boundar"]),
        M("M-103", "K-01", "Spec-first & Orchestrierung", "Vom Prompt zur Spezifikation: Entwickler als Orchestratoren und Verifizierer.", "B", "Technological", [r"spec", r"orchestrat", r"verification architect", r"human.in.the.loop"]),
        M("M-104", "K-01", "Coding-Assistenten & DevTools", "Copilot & Co. verändern Werkzeuge und Arbeitsweise.", "D", "Technological", [r"copilot", r"vibe coding", r"coding agent", r"developer tool", r"ai.assisted", r"lovable|kiro\b"]),
        M("M-105", "K-01", "Evals, Guardrails & AI-Testing", "Qualitätssicherung für KI: Evaluation, Halluzinationstests, Guardrails.", "C", "Technological", [r"eval", r"guardrail", r"hallucinat", r"tests? are lying", r"testing in the age of ai|ai expose"]),
        M("M-201", "K-02", "RAG & Retrieval", "Retrieval als schwächstes Glied: GraphRAG, Hybrid-RAG, Edge-Retrieval.", "D", "Technological", [r"\bRAG\b", r"retriev", r"vector|graphrag"]),
        M("M-202", "K-02", "Inferenz & LLM-Ökonomie", "Eigene Inference-Layer, Kostenoptimierung, Fine-Tuning statt Proprietär.", "A", "Economic", [r"inference", r"LLM cost|llm costs|cutting llm", r"fine.tun", r"own models|nemotron|open model"]),
        M("M-203", "K-02", "GPU-, Cloud- & Edge-Infrastruktur", "Kubernetes, GPU-Sharing, Edge-Deployments als KI-Rückgrat.", "D", "Technological", [r"kubernetes|k8s", r"\bGPU\b|MIG", r"edge", r"cloud native|serverless|filesystem"]),
        M("M-204", "K-02", "Physical AI & Robotik", "KI verlässt den Bildschirm: Roboter, Geräte, industrielle Systeme.", "D", "Technological", [r"physical ai", r"robot", r"RTX|AI PC", r"intelligent machines"]),
        M("M-301", "K-03", "KI als Angriffsfläche", "Prompt Injection, AI-Output als XSS, synthetische Insider.", "C", "Technological", [r"prompt injection", r"ai output|dangerous reactivity", r"synthetic insider", r"sudo", r"ai risk"]),
        M("M-302", "K-03", "Post-Quantum-Kryptografie", "Vorbereitung auf Q-Day: PQC-Verfahren in der Praxis.", "C", "Technological", [r"post.quantum", r"q.day", r"falcon", r"cryptograph"]),
        M("M-303", "K-03", "Supply-Chain & Compliance", "SBOM, OSS-Compliance, Regulierung als Entwickleralltag.", "C", "Political", [r"\bSBOM\b", r"supply chain", r"compliance", r"license|licens"]),
        M("M-304", "K-03", "Identität & Zero Trust", "Passkeys, OAuth-Evolution, Zero-Trust auch für Agenten.", "C", "Technological", [r"passkey", r"oauth|openid", r"zero.trust", r"authenticat"]),
        M("M-401", "K-04", "Rust im Mainstream", "Rust in Produktion: Adoption, Embedded, WebAssembly-Runtimes.", "D", "Technological", [r"\brust\b", r"webassembly|wasm"]),
        M("M-402", "K-04", "Plattform-Modernisierung", "C++26, Project Leyden, .NET-Source-Generatoren, Node-Modernisierung.", "D", "Technological", [r"c\+\+", r"leyden|jvm|java\b", r"\.net|c#", r"node\.js", r"kotlin|swift\b|typescript|ecmascript|go'?s concurrency"]),
        M("M-403", "K-04", "Architektur-Konsolidierung", "Self-Contained Systems, Hexagonal, antifragile Systeme statt Microservice-Maximalismus.", "D", "Technological", [r"microservice", r"self.contained", r"hexagonal", r"antifragile", r"architectur|architektur|entropy|migration"]),
        M("M-404", "K-04", "Qualität & Observability", "Observability, OpenTelemetry, Log-Strategien als Quality-Gate.", "D", "Technological", [r"observab", r"opentelemetry", r"log management", r"quality|qualit", r"incident"]),
        M("M-501", "K-05", "KI im Browser & Generative UI", "Built-in-LLMs, generative Oberflächen, Design Systems für Maschinen.", "D", "Technological", [r"browser", r"generative ui", r"design system", r"built.in llm"]),
        M("M-502", "K-05", "Web-Plattform & Frameworks", "Nach den Framework-Kriegen: Konsolidierung, CSS-Fortschritt, React-Interna.", "D", "Technological", [r"framework", r"\bcss\b", r"react|angular|jsx", r"what'?s new in web|pwa"]),
        M("M-503", "K-05", "Accessibility", "Barrierefreiheit als kontinuierliche Aufgabe – auch für KI-Output.", "B", "Social", [r"accessib", r"a11y"]),
        M("M-601", "K-06", "Reskilling & AI Economy", "Wer gewinnt in der KI-Ökonomie – Umschulung und neue Profile.", "B", "Social", [r"reskilling", r"ai economy", r"talent", r"hiring|recruit", r"skills"]),
        M("M-602", "K-06", "KI im Org-Chart", "KI-Mitarbeiter, HR-Transformation, Wissenserhalt.", "B", "Social", [r"workforce", r"org chart|org-chart", r"hr\b|human capital", r"agentic employee"]),
        M("M-603", "K-06", "Leadership & Produktivität", "10x-Organisationen, Metriken, Silos aufbrechen, Hype vermeiden.", "B", "Economic", [r"productivity|produktiv", r"leadership|leader", r"10x|metrics", r"silo|culture|cognitive debt|craftsmanship|read code"]),
        M("M-701", "K-07", "Digitale Souveränität", "Confidential Computing, souveräne KI-Plattformen und -Lieferketten.", "E", "Political", [r"sovereign", r"confidential computing", r"souverän"]),
        M("M-702", "K-07", "Europas KI-Moment", "Politik, VCs und Konzerne verhandeln Europas Rolle.", "E", "Political", [r"europe|europa", r"digital future", r"vc|venture|wrapper", r"ai moment"]),
        M("M-703", "K-07", "Nachhaltigkeit & Verantwortung", "Energie, Klimabilanz und gesellschaftliche Wirkung der KI.", "E", "Environmental", [r"sustainab", r"climate|klima", r"societal|responsib", r"life cycle"]),
    ],
    "track_default": {
        "AI Agents": "M-101", "AI Engineering": "M-202", "Security & Privacy": "M-301",
        "Languages & Runtimes": "M-402", "Software Architecture": "M-403", "Quality & Reliability": "M-404",
        "Data & Databases": "M-201", "Cloud & AI Infrastructure": "M-203", "DevOps": "M-203",
        "Frontend, Web & Mobile": "M-502", "Developer Experience": "M-104", "Talent Strategy": "M-601",
        "People & Culture": "M-602", "Engineering Leadership": "M-603", "Career & Growth": "M-601",
        "Strategy & Innovation": "M-702", "Emerging Technologies": "M-204",
    },
}

E9 = {
    "event_id": "E9-26", "archiv": "e9-archiv.json", "jahr": 2026, "datei": "radar-e9-26.json",
    "titel": "Insight Radar · 1E9 Festival der Zukunft 2026",
    "name": "1E9 – Festival der Zukunft 2026", "von": "2026-07-02", "bis": "2026-07-05",
    "ort": "München", "programm_url": "https://festivalderzukunft.com",
    "mit_inhalt": True,
    "makro": [
        K("K-01", "KI zwischen Souveränität und Bewusstsein", "Welche KI wollen wir – von souveränen Modellen über Produktions-Realität bis zur Bewusstseinsfrage.", "D", "Technological"),
        K("K-02", "Robotik wird alltagstauglich", "Humanoide verlassen das Labor: Simulation, Wahrnehmung, Bildung.", "D", "Technological"),
        K("K-03", "Mobilität & urbane Infrastruktur", "Kontrolle wandert von der App in die Infrastruktur – Routing, Bauen, Datenzentren.", "E", "Technological"),
        K("K-04", "Die Zukunft des Geldes", "Digitaler Euro, Stablecoins und Geld als gestaltbares Kulturgut.", "A", "Economic"),
        K("K-05", "Wissenschaft, Weltraum & Gesellschaft", "Fusion, Quanten, NewSpace und das Festival als öffentlicher Zukunftsort.", "E", "Social"),
    ],
    "mikro": [
        M("M-101", "K-01", "Souveräne KI & Werte", "Die Souveränitätsfrage schlägt die Leistungsfrage: welche KI, nach wessen Regeln.", "E", "Political", [r"souverän|sovereign", r"europ", r"regul|ai act", r"welche ki|verantwort"]),
        M("M-102", "K-01", "KI in der Produktion", "Vom Demo-Modus zu Dark Factories und industriellen Rollouts.", "A", "Economic", [r"dark factor", r"industri", r"produktion|rollout", r"mittelstand|enterprise"]),
        M("M-103", "K-01", "Vertrauen, Deepfakes & Medien", "KI-Content stellt Journalismus und Öffentlichkeit vor Vertrauensfragen.", "B", "Social", [r"deepfake", r"journalis|medien|media", r"desinform|vertrauen|trust"]),
        M("M-104", "K-01", "AI Safety & Bewusstsein", "Alignment, Prompt Injection und die offene Bewusstseinsfrage.", "C", "Technological", [r"safety|alignment", r"bewusstsein|conscious", r"prompt injection", r"agi\b"]),
        M("M-105", "K-01", "KI & Kreativität", "Generative KI in Kunst, Musik, Film und Mode.", "B", "Social", [r"kunst|art\b|artist", r"musik|music|hackatune", r"film|fashion|mode\b", r"kreativ|creative|generativ"]),
        M("M-201", "K-02", "Humanoide Roboter live", "Humanoide tanzen auf der Bühne statt nur im Video.", "D", "Technological", [r"humanoid", r"g1po|tanz|danc", r"robot"]),
        M("M-202", "K-02", "Simulation & Reinforcement Learning", "Neue Bewegungs-Skills entstehen in der Simulation.", "D", "Technological", [r"simulation", r"reinforcement", r"bewegung|motion"]),
        M("M-203", "K-02", "Wahrnehmung als Flaschenhals", "Knowing is seeing: Perzeption entscheidet über Autonomie.", "D", "Technological", [r"wahrnehmung|perception|seeing", r"\bDLR\b", r"autonom"]),
        M("M-204", "K-02", "Robotik zum Anfassen", "KidsLab, Robo-Battles und Bildung für den Nachwuchs.", "B", "Social", [r"kidslab|kinder|kids", r"battle", r"bildung|education|schule"]),
        M("M-301", "K-03", "Infrastruktur statt App", "Chips, Energie und Routing-Governance als eigentliche Machtfrage.", "E", "Political", [r"routing|robotaxi", r"mobilit|mobility|verkehr", r"governance|infrastruktur"]),
        M("M-302", "K-03", "Regeneratives Bauen", "Net-positive statt weniger schädlich: Architektur & Bau im Umbruch.", "E", "Environmental", [r"bauen|construction|architekt", r"regenerativ|net.positive", r"stadt|city|urban"]),
        M("M-303", "K-03", "Unsichtbare Dateninfrastruktur", "Rechenzentren, Kabel und Energie als Standortfrage.", "E", "Economic", [r"rechenzentr|data ?cent", r"kabel|strom|energie", r"standort"]),
        M("M-401", "K-04", "Digitaler Euro vs. Stablecoins", "Digitales Geld wird geopolitisch.", "A", "Political", [r"digitaler? euro", r"stablecoin", r"zentralbank|cbdc|geldpolitik"]),
        M("M-402", "K-04", "Krypto-Selbstreflexion", "Pioniere prüfen, ob die Bewegung ihre Ideale hielt.", "A", "Social", [r"krypto|crypto", r"bitcoin|ethereum|buterin|taaki", r"blockchain|defi|web3"]),
        M("M-403", "K-04", "Geld als Kulturtechnik", "Alternativwährungen und Geld als gestaltbares Konstrukt.", "A", "Social", [r"währung|currency", r"geld\b|money", r"yap|keats"]),
        M("M-501", "K-05", "Fusion & Quantentechnologie", "Reale Fusionskraftwerke und Quantencomputing für Deutschland.", "D", "Technological", [r"fusion", r"quant", r"proxima|planqc|iqm"]),
        M("M-502", "K-05", "NewSpace", "Europäische Raumfahrt zwischen Start-ups und Strategie.", "E", "Technological", [r"space|raumfahrt", r"satellit|orbit|rakete", r"exploration"]),
        M("M-503", "K-05", "Festival als öffentlicher Zukunftsort", "Wissenschaft, Familienprogramm und Kunst öffentlich zugänglich.", "B", "Social", [r"festival|museum", r"familie|öffentlich", r"community|workshop|meetup|ausstellung"]),
    ],
    "track_default": {},
}

if __name__ == "__main__":
    baue_radar(WAD)
    baue_radar(E9)
