// FEAT-24 H6-D — almacenamiento local del modo almacén: la cola de acciones sin
// conexión y lo último que se descargó (para consultar sin señal). Es un
// envoltorio chico sobre IndexedDB, sin librerías, más una versión en memoria con
// la misma interfaz: la usan los tests y los navegadores sin IndexedDB (ahí la cola
// no sobrevive a recargar la página).

export interface RecordStore<T> {
  getAll(): Promise<T[]>;
  get(key: string): Promise<T | undefined>;
  put(value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Copia profunda: lo guardado no cambia si después se modifica el objeto (igual que en IndexedDB). */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function memoryStore<T>(keyOf: (value: T) => string): RecordStore<T> {
  const rows = new Map<string, T>();
  return {
    async getAll() {
      return [...rows.values()].map(copy);
    },
    async get(key) {
      const value = rows.get(key);
      return value === undefined ? undefined : copy(value);
    },
    async put(value) {
      rows.set(keyOf(value), copy(value));
    },
    async delete(key) {
      rows.delete(key);
    },
  };
}

/* ---------------------------------------------------------------------------
   IndexedDB
--------------------------------------------------------------------------- */

const DB_NAME = "powip-almacen";
const DB_VERSION = 1;
export const QUEUE_STORE = "queue";
export const SNAPSHOT_STORE = "snapshots";

let opening: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Otra pestaña con una versión nueva: se cierra y se vuelve a abrir en el próximo uso.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
    };
    request.onblocked = () => {
      opening = null;
      reject(new Error("El almacenamiento local está bloqueado por otra pestaña."));
    };
  });
  return opening;
}

function run<R>(storeName: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> {
  return openDatabase().then(
    (db) =>
      new Promise<R>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = work(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? request.error);
        tx.onabort = () => reject(tx.error ?? new Error("Se canceló la escritura local."));
      }),
  );
}

export function indexedDbStore<T>(storeName: string): RecordStore<T> {
  return {
    getAll: () => run(storeName, "readonly", (store) => store.getAll() as IDBRequest<T[]>),
    get: (key) => run(storeName, "readonly", (store) => store.get(key) as IDBRequest<T | undefined>),
    put: async (value) => {
      await run(storeName, "readwrite", (store) => store.put(value));
    },
    delete: async (key) => {
      await run(storeName, "readwrite", (store) => store.delete(key));
    },
  };
}

/** ¿Se puede usar IndexedDB? (no existe en SSR y puede fallar en navegación privada). */
export async function indexedDbAvailable(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    await openDatabase();
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
   Errores de red
--------------------------------------------------------------------------- */

const NETWORK_CODES = new Set(["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"]);

/** Sin respuesta del servidor (sin señal, timeout o se cortó): no se sabe si llegó. */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { response?: unknown; code?: unknown; message?: unknown; isAxiosError?: unknown; name?: unknown };
  if (candidate.response) return false;
  if (typeof candidate.code === "string" && NETWORK_CODES.has(candidate.code)) return true;
  if (candidate.isAxiosError === true && candidate.name !== "CanceledError") return true;
  return candidate.name === "TypeError" && /fetch|network/i.test(String(candidate.message ?? ""));
}

/* ---------------------------------------------------------------------------
   Lo último descargado (consultas sin señal)
--------------------------------------------------------------------------- */

export interface Snapshot<T = unknown> {
  key: string;
  data: T;
  savedAt: number;
}

export interface SnapshotRead<T> {
  data: T;
  savedAt: number;
  /** true = sin señal: se muestra lo último descargado. */
  fromCache: boolean;
}

export class OfflineUnavailableError extends Error {
  constructor(message = "Sin conexión: esto todavía no se descargó en este celular.") {
    super(message);
    this.name = "OfflineUnavailableError";
  }
}

/**
 * Con señal: descarga, guarda una copia y la devuelve. Sin señal (o si la red falla): devuelve la última
 * copia con su hora. Un error del servidor (4xx/5xx) no se tapa con la copia: se lanza.
 */
export async function readWithSnapshot<T>(
  store: RecordStore<Snapshot>,
  key: string,
  fetcher: () => Promise<T>,
  options: { online: boolean; now?: () => number },
): Promise<SnapshotRead<T>> {
  const now = options.now ?? Date.now;
  if (options.online) {
    try {
      const data = await fetcher();
      const savedAt = now();
      try {
        await store.put({ key, data, savedAt });
      } catch {
        // Sin espacio o sin IndexedDB: se muestra igual, solo no queda para usar sin señal.
      }
      return { data, savedAt, fromCache: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  const cached = await store.get(key).catch(() => undefined);
  if (!cached) throw new OfflineUnavailableError();
  return { data: cached.data as T, savedAt: cached.savedAt, fromCache: true };
}
