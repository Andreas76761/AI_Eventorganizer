// Cloud-Modul: Supabase-Anbindung (Auth mit MFA, Zustands-Sync, Konto-Löschung).
// Aktiv nur, wenn js/config.js gültige Werte enthält – sonst bleibt die App im
// lokalen Modus und dieses Modul tut nichts. Datenbankschema: supabase/schema.sql.

"use strict";

const CLOUD = {
  client: null,
  nutzer: null,          // Supabase-Auth-User
  syncTimer: null,

  aktiv() { return !!this.client; },

  async init() {
    const k = window.APP_KONFIG;
    // Nur aktivieren, wenn URL und Key echt aussehen: Supabase-Keys sind JWTs ("eyJ…")
    // oder neue Publishable-Keys ("sb_publishable_…") – alles andere ist Platzhalter.
    if (!k || !k.SUPABASE_URL || k.SUPABASE_URL.includes("DEIN-PROJEKT")) return false;
    const key = k.SUPABASE_ANON_KEY || "";
    if (!(key.startsWith("eyJ") || key.startsWith("sb_publishable_")) || key.length < 40) return false;
    // supabase-js erst laden, wenn wirklich konfiguriert (kein CDN-Zugriff im Lokalmodus)
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("supabase-js konnte nicht geladen werden"));
        document.head.appendChild(s);
      });
    }
    this.client = window.supabase.createClient(k.SUPABASE_URL, k.SUPABASE_ANON_KEY);
    const { data } = await this.client.auth.getSession();
    if (data?.session) {
      this.nutzer = data.session.user;
      await this.zustandLaden();
    }
    return true;
  },

  /* ---------- Auth ---------- */

  async registrieren(email, passwort) {
    const { data, error } = await this.client.auth.signUp({ email, password: passwort });
    if (error) throw error;
    return data; // E-Mail-Bestätigung je nach Projekt-Einstellung nötig
  },

  async anmelden(email, passwort) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password: passwort });
    if (error) throw error;
    this.nutzer = data.user;
    // MFA-Prüfung: Ist ein zweiter Faktor nötig?
    const { data: aal } = await this.client.auth.mfa.getAuthenticatorAssuranceLevel();
    return { mfaNoetig: aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2" };
  },

  async abmelden() {
    await this.client.auth.signOut();
    this.nutzer = null;
  },

  /* ---------- MFA (TOTP – Authenticator-App) ---------- */

  async mfaEinrichten() {
    const { data, error } = await this.client.auth.mfa.enroll({ factorType: "totp" });
    if (error) throw error;
    // data.totp: {qr_code (SVG-Data-URI), secret, uri}
    return { faktorId: data.id, qr: data.totp.qr_code, geheimnis: data.totp.secret, uri: data.totp.uri };
  },

  async mfaBestaetigen(faktorId, code) {
    const { data: ch, error: e1 } = await this.client.auth.mfa.challenge({ factorId: faktorId });
    if (e1) throw e1;
    const { error: e2 } = await this.client.auth.mfa.verify({ factorId: faktorId, challengeId: ch.id, code });
    if (e2) throw e2;
    return true;
  },

  async mfaFaktoren() {
    const { data } = await this.client.auth.mfa.listFactors();
    return data?.totp || [];
  },

  /* ---------- Zustands-Synchronisation ---------- */
  // Einfaches, robustes Modell: der komplette App-Zustand liegt als JSONB-Zeile
  // pro Nutzer in app_state (RLS: nur der eigene Datensatz ist les-/schreibbar).
  // Konfliktschutz: rev-Zähler + Gerätekennung – schreibt ein anderes Gerät
  // zwischendurch, wird gefragt statt still überschrieben (kein Last-write-wins).

  bekannteRev: 0,

  geraetId() {
    let g = localStorage.getItem("aimg2026_geraet");
    if (!g) {
      const basis = (navigator.platform || "Gerät").split(" ")[0];
      g = basis + "-" + Math.random().toString(36).slice(2, 6);
      try { localStorage.setItem("aimg2026_geraet", g); } catch (e) { }
    }
    return g;
  },

  async zustandLaden() {
    if (!this.nutzer) return;
    const { data, error } = await this.client.from("app_state")
      .select("state, rev").eq("user_id", this.nutzer.id).maybeSingle();
    if (error) { console.warn("Cloud-Laden fehlgeschlagen:", error.message); return; }
    this.bekannteRev = data?.rev || 0;
    if (data?.state) {
      localStorage.setItem(NS, JSON.stringify(data.state));
      S = loadState();
      render();
    }
  },

  zustandSpeichern() {
    if (!this.nutzer) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncJetzt(), 1500);
  },

  async syncJetzt() {
    if (!this.nutzer) return;
    try {
      // Vor dem Schreiben prüfen, ob ein anderes Gerät inzwischen gespeichert hat
      const { data: z } = await this.client.from("app_state")
        .select("rev, geraet, updated_at").eq("user_id", this.nutzer.id).maybeSingle();
      const cloudRev = z?.rev || 0;
      if (z && cloudRev > this.bekannteRev && z.geraet && z.geraet !== this.geraetId()) {
        const wann = z.updated_at ? new Date(z.updated_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "unbekannt";
        const cloudUebernehmen = confirm(
          `Sync-Konflikt: In der Cloud liegt ein neuerer Stand von Gerät „${z.geraet}“ (${wann}).\n\n` +
          `OK = Cloud-Stand übernehmen (die letzten Änderungen auf diesem Gerät gehen verloren)\n` +
          `Abbrechen = Cloud mit dem Stand dieses Geräts überschreiben`);
        if (cloudUebernehmen) { await this.zustandLaden(); return; }
      }
      const neueRev = Math.max(cloudRev, this.bekannteRev) + 1;
      const { error } = await this.client.from("app_state").upsert({
        user_id: this.nutzer.id,
        state: S,
        updated_at: new Date().toISOString(),
        rev: neueRev,
        geraet: this.geraetId()
      });
      if (error) { console.warn("Cloud-Sync fehlgeschlagen:", error.message); return; }
      this.bekannteRev = neueRev;
    } catch (e) { console.warn("Cloud-Sync fehlgeschlagen:", e.message); }
  },

  /* ---------- Datei-Backup in Supabase Storage (Bucket "dateien", je Nutzer eigener Ordner) ---------- */
  // Manuell ausgelöst (Konto & Daten): sichert alle IndexedDB-Records (Materialien,
  // Bilder, Projekteinträge) in die Cloud bzw. stellt sie zusammenführend wieder her.

  async dateienSichern(melde) {
    if (!this.nutzer) throw new Error("nicht angemeldet");
    const alle = await dbAlleDateien();
    const basis = this.nutzer.id + "/";
    const meta = [];
    let hoch = 0;
    for (const r of alle) {
      const kopie = Object.assign({}, r); delete kopie.blob;
      kopie.__hatBlob = !!r.blob;
      meta.push(kopie);
      if (r.blob) {
        const { error } = await this.client.storage.from("dateien")
          .upload(basis + encodeURIComponent(r.id), r.blob, { upsert: true, contentType: r.blob.type || r.mime || "application/octet-stream" });
        if (error) throw new Error("Upload " + r.id + ": " + error.message);
        hoch++;
        if (melde) melde(`${hoch} Datei(en) hochgeladen …`);
      }
    }
    const metaBlob = new Blob([JSON.stringify({ stand: new Date().toISOString(), eintraege: meta })], { type: "application/json" });
    const { error } = await this.client.storage.from("dateien").upload(basis + "__meta.json", metaBlob, { upsert: true, contentType: "application/json" });
    if (error) throw new Error("Metadaten: " + error.message);
    return { eintraege: meta.length, blobs: hoch };
  },

  async dateienWiederherstellen(melde) {
    if (!this.nutzer) throw new Error("nicht angemeldet");
    const basis = this.nutzer.id + "/";
    const { data: metaDatei, error: e1 } = await this.client.storage.from("dateien").download(basis + "__meta.json");
    if (e1) throw new Error("Kein Cloud-Datei-Backup gefunden (" + e1.message + ")");
    const meta = JSON.parse(await metaDatei.text());
    let n = 0, fehler = 0;
    for (const eintrag of meta.eintraege || []) {
      try {
        const rec = Object.assign({}, eintrag);
        const hatBlob = rec.__hatBlob; delete rec.__hatBlob;
        if (hatBlob) {
          const { data: b, error: e2 } = await this.client.storage.from("dateien").download(basis + encodeURIComponent(rec.id));
          if (e2) throw e2;
          rec.blob = new Blob([await b.arrayBuffer()], { type: rec.mime || b.type || "application/octet-stream" });
        }
        await dbPutFile(rec); n++;
        if (melde && n % 5 === 0) melde(`${n} Einträge wiederhergestellt …`);
      } catch (e) { fehler++; }
    }
    return { n, fehler, stand: meta.stand };
  },

  /* ---------- DSGVO: Export & Löschung ---------- */

  async kontoLoeschen() {
    // Ruft die SECURITY-DEFINER-Funktion delete_user() auf (supabase/schema.sql):
    // löscht app_state-Zeile und das Auth-Konto des aufrufenden Nutzers.
    const { error } = await this.client.rpc("delete_user");
    if (error) throw error;
    await this.client.auth.signOut();
    this.nutzer = null;
  }
};
