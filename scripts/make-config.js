// Vercel-Build: erzeugt js/config.js aus Umgebungsvariablen (SUPABASE_URL, SUPABASE_ANON_KEY).
// Lokal bleibt die gitignorierte js/config.js maßgeblich; ohne Env-Variablen läuft die App im Lokalmodus.
const fs = require("fs");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log("make-config: SUPABASE_URL/SUPABASE_ANON_KEY nicht gesetzt – Deployment läuft im Lokalmodus.");
  process.exit(0);
}
const inhalt = `// Automatisch beim Vercel-Build erzeugt (scripts/make-config.js).
// Der anon-Key ist der öffentliche Client-Key; Sicherheit erzwingen die RLS-Policies.
window.APP_KONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)}
};
`;
fs.writeFileSync("js/config.js", inhalt);
console.log("make-config: js/config.js erzeugt – Cloud-Modus aktiv.");
