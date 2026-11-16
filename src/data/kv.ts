/** Armazém chave-valor assíncrono: IndexedDB, com localStorage/memória como reserva. */
const DB = 'gerenciador-rpg';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
const memory = new Map<string, unknown>();

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const kv = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return (await idb('readonly', (s) => s.get(key))) as T | undefined;
    } catch {
      try {
        const raw = localStorage.getItem('kv:' + key);
        return raw ? (JSON.parse(raw) as T) : (memory.get(key) as T | undefined);
      } catch {
        return memory.get(key) as T | undefined;
      }
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await idb('readwrite', (s) => s.put(value as any, key));
    } catch {
      memory.set(key, value);
      try { localStorage.setItem('kv:' + key, JSON.stringify(value)); } catch { /* cota cheia: fica só na memória */ }
    }
  },
  async del(key: string): Promise<void> {
    try {
      await idb('readwrite', (s) => s.delete(key));
    } catch {
      memory.delete(key);
      try { localStorage.removeItem('kv:' + key); } catch { /* ignora */ }
    }
  },
};
