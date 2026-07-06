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
    if (!k || !k.SUPABASE_URL || k.SUPABASE_URL.includes("DEIN-PROJEKT") || !k.SUPABASE_ANON_KEY) return false;
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

  async zustandLaden() {
    if (!this.nutzer) return;
    const { data, error } = await this.client.from("app_state")
      .select("state").eq("user_id", this.nutzer.id).maybeSingle();
    if (error) { console.warn("Cloud-Laden fehlgeschlagen:", error.message); return; }
    if (data?.state) {
      localStorage.setItem(NS, JSON.stringify(data.state));
      S = loadState();
      render();
    }
  },

  zustandSpeichern() {
    if (!this.nutzer) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(async () => {
      const { error } = await this.client.from("app_state").upsert({
        user_id: this.nutzer.id,
        state: S,
        updated_at: new Date().toISOString()
      });
      if (error) console.warn("Cloud-Sync fehlgeschlagen:", error.message);
    }, 1500);
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
