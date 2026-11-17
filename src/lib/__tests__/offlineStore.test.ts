import { isNetworkError, memoryStore, OfflineUnavailableError, readWithSnapshot, type Snapshot } from "../offlineStore";

// FEAT-24 H6-D — almacenamiento local del modo almacén: copia en memoria (la
// usan los tests y los navegadores sin IndexedDB) y «lo último descargado».

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

describe("memoryStore", () => {
  it("guarda copias: cambiar el objeto después no cambia lo guardado", async () => {
    const store = memoryStore<{ id: string; list: number[] }>((row) => row.id);
    const row = { id: "a", list: [1] };
    await store.put(row);
    row.list.push(2);
    expect(await store.get("a")).toEqual({ id: "a", list: [1] });
    await store.delete("a");
    expect(await store.getAll()).toEqual([]);
  });
});

describe("isNetworkError", () => {
  it("sin respuesta del servidor es error de red; con respuesta o cancelado, no", () => {
    expect(isNetworkError(networkError())).toBe(true);
    expect(isNetworkError(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }))).toBe(true);
    expect(isNetworkError(Object.assign(new TypeError("Failed to fetch")))).toBe(true);
    expect(isNetworkError({ isAxiosError: true, response: { status: 500 } })).toBe(false);
    expect(isNetworkError(Object.assign(new Error("x"), { isAxiosError: true, name: "CanceledError" }))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("readWithSnapshot", () => {
  const now = () => 1_000;

  it("con señal descarga, guarda la copia y la devuelve como fresca", async () => {
    const store = memoryStore<Snapshot>((row) => row.key);
    await expect(readWithSnapshot(store, "k", async () => ({ stock: 3 }), { online: true, now })).resolves.toEqual({
      data: { stock: 3 },
      savedAt: 1_000,
      fromCache: false,
    });
    expect(await store.get("k")).toEqual({ key: "k", data: { stock: 3 }, savedAt: 1_000 });
  });

  it("sin señal devuelve la última copia con su hora, sin llamar al servidor", async () => {
    const store = memoryStore<Snapshot>((row) => row.key);
    await store.put({ key: "k", data: { stock: 2 }, savedAt: 500 });
    const fetcher = jest.fn();
    await expect(readWithSnapshot(store, "k", fetcher, { online: false, now })).resolves.toEqual({
      data: { stock: 2 },
      savedAt: 500,
      fromCache: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("si la red falla con señal aparente, también usa la copia", async () => {
    const store = memoryStore<Snapshot>((row) => row.key);
    await store.put({ key: "k", data: "viejo", savedAt: 500 });
    await expect(readWithSnapshot(store, "k", () => Promise.reject(networkError()), { online: true, now })).resolves.toMatchObject({
      data: "viejo",
      fromCache: true,
    });
  });

  it("un error del servidor no se tapa con la copia", async () => {
    const store = memoryStore<Snapshot>((row) => row.key);
    await store.put({ key: "k", data: "viejo", savedAt: 500 });
    const forbidden = { isAxiosError: true, response: { status: 403 } };
    await expect(readWithSnapshot(store, "k", () => Promise.reject(forbidden), { online: true, now })).rejects.toBe(forbidden);
  });

  it("sin señal y sin copia avisa que no se descargó en este celular", async () => {
    const store = memoryStore<Snapshot>((row) => row.key);
    await expect(readWithSnapshot(store, "k", jest.fn(), { online: false, now })).rejects.toBeInstanceOf(OfflineUnavailableError);
  });
});
