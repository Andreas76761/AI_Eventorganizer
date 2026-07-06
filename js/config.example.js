// Supabase-Konfiguration – Vorlage.
// 1. Datei kopieren nach: js/config.js  (config.js steht in .gitignore!)
// 2. Werte aus deinem Supabase-Projekt eintragen (Project Settings → API).
// 3. Ohne config.js läuft die App im lokalen Modus (alles im Browser, kein Server).
//
// Der ANON-Key ist als öffentlicher Client-Key konzipiert – die Zugriffssicherheit
// erzwingen die Row-Level-Security-Policies (siehe supabase/schema.sql).

window.APP_KONFIG = {
  SUPABASE_URL: "https://DEIN-PROJEKT.supabase.co",
  SUPABASE_ANON_KEY: "DEIN-ANON-KEY"
};
