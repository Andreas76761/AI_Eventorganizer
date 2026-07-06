// IndexedDB-Helfer für Dateien (Präsentationen) und Bilder pro Veranstaltung.
// LocalStorage wäre für Binärdaten zu klein – daher IndexedDB mit einem Store "dateien".

const DB_NAME = "aimg2026_files";
const DB_STORE = "dateien";

function dbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, { keyPath: "id" });
        store.createIndex("byEvent", "eventId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutFile(record) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbFilesForEvent(eventId, typ) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const idx = tx.objectStore(DB_STORE).index("byEvent");
    const req = idx.getAll(eventId);
    req.onsuccess = () => {
      let rows = req.result || [];
      if (typ) rows = rows.filter(r => r.typ === typ);
      rows.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbDeleteFile(id) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetFile(id) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
