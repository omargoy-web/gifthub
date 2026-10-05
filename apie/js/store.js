/* Persistencia local: IndexedDB clave-valor con caché en memoria.
   Todo el estado del usuario vive en el dispositivo; la sincronización con
   Google es opcional y explícita (bandeja de salida para fallas). */
(function () {
  const DB = "apie_idb", OS = "kv", VER = 1;
  const mem = {};
  let dbp = null;
  const timers = {};

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        const rq = indexedDB.open(DB, VER);
        rq.onupgradeneeded = () => rq.result.createObjectStore(OS);
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }

  async function idbGet(k) {
    const db = await open();
    if (!db) { try { return JSON.parse(localStorage.getItem("apie:" + k)); } catch (e) { return undefined; } }
    return new Promise((res) => {
      const rq = db.transaction(OS).objectStore(OS).get(k);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(undefined);
    });
  }

  async function idbPut(k, v) {
    const db = await open();
    if (!db) { try { localStorage.setItem("apie:" + k, JSON.stringify(v)); } catch (e) {} return; }
    return new Promise((res) => {
      const tx = db.transaction(OS, "readwrite");
      tx.objectStore(OS).put(v, k);
      tx.oncomplete = res; tx.onerror = res;
    });
  }

  const KEYS = ["session", "prefs", "tasks", "events", "eventNotes", "faults", "annotations", "bookmarks", "learning", "chat"];

  window.Store = {
    async init() {
      await Promise.all(KEYS.map(async (k) => { mem[k] = await idbGet(k); }));
    },
    get(k, def) { return mem[k] === undefined ? def : mem[k]; },
    set(k, v) {
      mem[k] = v;
      clearTimeout(timers[k]);
      timers[k] = setTimeout(() => idbPut(k, v), 150);
      return v;
    },
    update(k, def, fn) { const v = fn(structuredClone(this.get(k, def))); return this.set(k, v); },
    async flush() { await Promise.all(Object.keys(timers).map((k) => idbPut(k, mem[k]))); },
    async wipe() {
      KEYS.forEach((k) => { mem[k] = undefined; });
      const db = await open();
      if (db) await new Promise((r) => { const tx = db.transaction(OS, "readwrite"); tx.objectStore(OS).clear(); tx.oncomplete = r; });
      try { Object.keys(localStorage).filter((k) => k.startsWith("apie:")).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    },
  };

  window.uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
})();
