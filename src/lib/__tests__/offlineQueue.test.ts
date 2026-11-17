import {
  classifyFailure,
  createOfflineQueue,
  QueueRejectedError,
  settleOutcome,
  type ActionHandler,
  type QueuedAction,
  type QueueSession,
} from "../offlineQueue";
import { memoryStore } from "../offlineStore";

// FEAT-24 H6-D — cola sin conexión del modo almacén: orden, reintento sin
// duplicar, conflicto a «Para revisar» y lo que sobrevive a recargar.

const SESSION: QueueSession = { companyId: "c-1", userId: "u-1" };

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });
const httpError = (status: number, message?: string) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: message ? { message } : {} } });

/** Un «servidor» de mentira: cuenta lo aplicado por clave y permite fallar a pedido. */
function fakeServer() {
  const applied: Array<{ key: string; value: string }> = [];
  const failures: Array<(value: string) => unknown> = [];
  const handler: ActionHandler<{ value: string }, string> = {
    async send({ value }, { idempotencyKey }) {
      const fail = failures.shift();
      const error = fail?.(value);
      if (error === "applied-then-lost") {
        applied.push({ key: idempotencyKey, value });
        throw networkError();
      }
      if (error) throw error;
      applied.push({ key: idempotencyKey, value });
      return `ok:${value}`;
    },
    async verify({ value }) {
      return applied.some((row) => row.value === value) ? { applied: true, result: `verificado:${value}` } : { applied: false };
    },
  };
  return { applied, failures, handler };
}

function setup(options: { online?: boolean; session?: QueueSession | null; store?: ReturnType<typeof memoryStore<QueuedAction>> } = {}) {
  let online = options.online ?? true;
  let session = options.session === undefined ? SESSION : options.session;
  let id = 0;
  const store = options.store ?? memoryStore<QueuedAction>((action) => action.id);
  const server = fakeServer();
  const onChange = jest.fn();
  const make = () =>
    createOfflineQueue({
      store,
      handlers: { write: server.handler as ActionHandler<never, unknown> },
      session: () => session,
      isOnline: () => online,
      newId: () => `key-${++id}`,
      onChange,
    });
  return {
    queue: make(),
    reload: make,
    store,
    server,
    onChange,
    goOnline: () => (online = true),
    goOffline: () => (online = false),
    setSession: (next: QueueSession | null) => (session = next),
  };
}

describe("cola sin conexión del modo almacén (FEAT-24 H6-D)", () => {
  it("con señal envía enseguida y devuelve la respuesta del servidor con la clave de la acción", async () => {
    const { queue, server, store } = setup();
    await expect(queue.enqueue("write", { value: "A" })).resolves.toEqual({ status: "done", id: "key-1", result: "ok:A" });
    expect(server.applied).toEqual([{ key: "key-1", value: "A" }]);
    expect(await store.getAll()).toEqual([]);
  });

  it("sin señal guarda y, al volver, envía en el orden en que se hicieron", async () => {
    const { queue, server, goOnline } = setup({ online: false });
    for (const value of ["A", "B", "C"]) {
      await expect(queue.enqueue("write", { value })).resolves.toMatchObject({ status: "queued", reason: "offline" });
    }
    expect(server.applied).toEqual([]);
    goOnline();
    await expect(queue.flush()).resolves.toEqual({ applied: 3, review: 0, stopped: null });
    expect(server.applied.map((row) => row.value)).toEqual(["A", "B", "C"]);
    expect(server.applied.map((row) => row.key)).toEqual(["key-1", "key-2", "key-3"]);
  });

  it("un error de red corta el envío para no desordenar y reintenta con la misma clave", async () => {
    const { queue, server, store, goOffline, goOnline } = setup({ online: false });
    await queue.enqueue("write", { value: "A" });
    await queue.enqueue("write", { value: "B" });
    goOnline();
    // A falla sin que el servidor la reciba (sin señal real).
    server.failures.push(() => networkError());
    await expect(queue.flush()).resolves.toMatchObject({ applied: 0, stopped: "uncertain" });
    expect(server.applied).toEqual([]);
    const kept = await queue.list();
    expect(kept.map((action) => [action.id, action.status])).toEqual([
      ["key-1", "uncertain"],
      ["key-2", "pending"],
    ]);
    goOffline();
    await expect(queue.flush()).resolves.toMatchObject({ stopped: "offline" });
    goOnline();
    await expect(queue.flush()).resolves.toEqual({ applied: 2, review: 0, stopped: null });
    expect(server.applied).toEqual([
      { key: "key-1", value: "A" },
      { key: "key-2", value: "B" },
    ]);
    expect(await store.getAll()).toEqual([]);
  });

  it("si el servidor la aplicó pero la respuesta se perdió, verifica y NO la reenvía (sin duplicar)", async () => {
    const { queue, server } = setup();
    server.failures.push(() => "applied-then-lost");
    await expect(queue.enqueue("write", { value: "A" })).resolves.toMatchObject({ status: "queued", reason: "no_response" });
    expect((await queue.list())[0]).toMatchObject({ status: "uncertain", attempts: 1 });
    await expect(queue.flush()).resolves.toEqual({ applied: 1, review: 0, stopped: null });
    expect(server.applied).toHaveLength(1);
    expect(await queue.list()).toEqual([]);
  });

  it("un 4xx de negocio va a «Para revisar» con el mensaje del servidor y la cola sigue", async () => {
    const { queue, server, goOnline } = setup({ online: false });
    await queue.enqueue("write", { value: "A" });
    await queue.enqueue("write", { value: "B" });
    goOnline();
    server.failures.push(() => httpError(409, "El pedido ya lo despachó otra persona."));
    await expect(queue.flush()).resolves.toEqual({ applied: 1, review: 1, stopped: null });
    const [review] = await queue.list();
    expect(review).toMatchObject({
      id: "key-1",
      status: "review",
      httpStatus: 409,
      lastError: "El pedido ya lo despachó otra persona.",
    });
    expect(server.applied.map((row) => row.value)).toEqual(["B"]);
    // Lo de «Para revisar» no se vuelve a mandar solo.
    await queue.flush();
    expect(server.applied.map((row) => row.value)).toEqual(["B"]);
  });

  it("si el usuario espera la acción en pantalla, el rechazo se le muestra a él y no se guarda", async () => {
    const { queue, server } = setup();
    server.failures.push(() => httpError(400, "El código no corresponde a ningún producto de este pedido."));
    const outcome = await queue.enqueue("write", { value: "X" });
    expect(outcome).toEqual({
      status: "rejected",
      id: "key-1",
      httpStatus: 400,
      message: "El código no corresponde a ningún producto de este pedido.",
    });
    expect(await queue.list()).toEqual([]);
    expect(() => settleOutcome(outcome)).toThrow(QueueRejectedError);
  });

  it("sobrevive a recargar: lo guardado se envía desde otra instancia sobre el mismo almacenamiento", async () => {
    const first = setup({ online: false });
    await first.queue.enqueue("write", { value: "A" });
    await first.queue.enqueue("write", { value: "B" });
    first.goOnline();
    const reloaded = first.reload();
    await expect(reloaded.flush()).resolves.toEqual({ applied: 2, review: 0, stopped: null });
    expect(first.server.applied.map((row) => row.value)).toEqual(["A", "B"]);
  });

  it("una acción que quedó «enviando» al recargar se verifica antes de reenviar", async () => {
    const { store, reload, server } = setup();
    // Quedó a medio enviar y el servidor sí la aplicó.
    await store.put({
      id: "key-9",
      kind: "write",
      payload: { value: "A" },
      companyId: SESSION.companyId,
      userId: SESSION.userId,
      seq: 1,
      createdAt: 1,
      updatedAt: 1,
      status: "sending",
      attempts: 1,
      checkpoint: null,
    });
    server.applied.push({ key: "key-9", value: "A" });
    await expect(reload().flush()).resolves.toEqual({ applied: 1, review: 0, stopped: null });
    expect(server.applied).toHaveLength(1);
  });

  it("verifica y reenvía si al recargar la acción a medio enviar no se había aplicado", async () => {
    const { store, reload, server } = setup();
    await store.put({
      id: "key-9",
      kind: "write",
      payload: { value: "A" },
      companyId: SESSION.companyId,
      userId: SESSION.userId,
      seq: 1,
      createdAt: 1,
      updatedAt: 1,
      status: "sending",
      attempts: 1,
      checkpoint: null,
    });
    await reload().flush();
    expect(server.applied).toEqual([{ key: "key-9", value: "A" }]);
  });

  it("solo envía las acciones de la sesión actual", async () => {
    const { queue, server, setSession, goOnline, goOffline } = setup({ online: false });
    await queue.enqueue("write", { value: "de-u1" });
    setSession({ companyId: "c-1", userId: "u-2" });
    await queue.enqueue("write", { value: "de-u2" });
    goOnline();
    await queue.flush();
    expect(server.applied.map((row) => row.value)).toEqual(["de-u2"]);
    goOffline();
    setSession(null);
    goOnline();
    await expect(queue.flush()).resolves.toMatchObject({ stopped: "no_session" });
    expect(await queue.list()).toHaveLength(1);
  });

  it("401 y 429 no la aplican: queda pendiente para después, sin ir a revisar", async () => {
    const { queue, server } = setup();
    server.failures.push(() => httpError(401));
    await expect(queue.enqueue("write", { value: "A" })).resolves.toMatchObject({ status: "queued" });
    expect((await queue.list())[0]).toMatchObject({ status: "pending", httpStatus: 401 });
    server.failures.push(() => httpError(429));
    await expect(queue.flush()).resolves.toMatchObject({ stopped: "retry" });
    await expect(queue.flush()).resolves.toMatchObject({ applied: 1 });
    expect(server.applied).toEqual([{ key: "key-1", value: "A" }]);
  });

  it("una verificación que encuentra otra versión aplicada va a revisar con ese motivo", async () => {
    const store = memoryStore<QueuedAction>((action) => action.id);
    const send = jest.fn();
    const queue = createOfflineQueue({
      store,
      session: () => SESSION,
      isOnline: () => true,
      handlers: {
        write: { send, verify: async () => ({ conflict: "Otra persona lo recibió con otras cantidades." }) } as ActionHandler<never, unknown>,
      },
    });
    await store.put({
      id: "k",
      kind: "write",
      payload: {},
      companyId: "c-1",
      userId: "u-1",
      seq: 1,
      createdAt: 1,
      updatedAt: 1,
      status: "uncertain",
      attempts: 1,
    });
    await expect(queue.flush()).resolves.toEqual({ applied: 0, review: 1, stopped: null });
    expect(send).not.toHaveBeenCalled();
    expect((await queue.list())[0]).toMatchObject({ status: "review", lastError: "Otra persona lo recibió con otras cantidades." });
  });

  it("prepare guarda el checkpoint antes del primer envío y se usa al verificar", async () => {
    const store = memoryStore<QueuedAction>((action) => action.id);
    const verify = jest.fn(async () => ({ applied: false as const }));
    const send = jest.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce("ok");
    const prepare = jest.fn(async () => ({ picked: 3 }));
    const queue = createOfflineQueue({
      store,
      session: () => SESSION,
      isOnline: () => true,
      newId: () => "k",
      handlers: { write: { prepare, send, verify } as ActionHandler<never, unknown> },
    });
    await queue.enqueue("write", {});
    expect((await queue.list())[0]).toMatchObject({ status: "uncertain", checkpoint: { picked: 3 } });
    await queue.flush();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({}, expect.objectContaining({ checkpoint: { picked: 3 } }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map((call) => call[1].idempotencyKey)).toEqual(["k", "k"]);
  });

  it("un error que deja la acción hecha (appliedOnError) la cierra con su mensaje", async () => {
    const queue = createOfflineQueue({
      store: memoryStore<QueuedAction>((action) => action.id),
      session: () => SESSION,
      isOnline: () => true,
      newId: () => "k",
      handlers: {
        write: {
          send: async () => Promise.reject(httpError(503)),
          appliedOnError: () => ({ message: "El despacho quedó pendiente." }),
        } as ActionHandler<never, unknown>,
      },
    });
    await expect(queue.enqueue("write", {})).resolves.toEqual({ status: "done", id: "k", result: undefined, message: "El despacho quedó pendiente." });
    expect(await queue.list()).toEqual([]);
  });

  it("«Reintentar» manda una acción de revisar al final con una clave nueva; «Descartar» la borra", async () => {
    const { queue, server, goOnline } = setup({ online: false });
    await queue.enqueue("write", { value: "A" });
    await queue.enqueue("write", { value: "B" });
    goOnline();
    server.failures.push(() => httpError(409, "conflicto"));
    server.failures.push(() => httpError(409, "conflicto"));
    await queue.flush();
    expect((await queue.list()).map((action) => action.status)).toEqual(["review", "review"]);
    await queue.retry("key-1");
    await queue.discard("key-2");
    const [retried] = await queue.list();
    expect(retried).toMatchObject({ id: "key-3", status: "pending", attempts: 0 });
    await queue.flush();
    expect(server.applied).toEqual([{ key: "key-3", value: "A" }]);
  });

  it("avisa los cambios y marca como «synced» lo aplicado que nadie esperaba en pantalla", async () => {
    const { queue, onChange, goOnline } = setup({ online: false });
    await queue.enqueue("write", { value: "A" });
    goOnline();
    onChange.mockClear();
    await queue.flush();
    expect(onChange).toHaveBeenCalledWith({ synced: true });
  });
});

describe("classifyFailure", () => {
  it.each([
    [networkError(), "uncertain"],
    [Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }), "uncertain"],
    [httpError(500), "uncertain"],
    [httpError(408), "uncertain"],
    [httpError(401), "auth"],
    [httpError(429), "retry"],
    [Object.assign(new Error("canceled"), { name: "CanceledError", code: "ERR_CANCELED" }), "retry"],
    [httpError(400, "mal"), "business"],
    [httpError(409, ["uno", "dos"] as unknown as string), "business"],
  ])("%p → %s", (error, kind) => {
    expect(classifyFailure(error).kind).toBe(kind);
  });

  it("toma el mensaje del servidor (texto o lista)", () => {
    expect(classifyFailure(httpError(409, ["Falta stock", "Revisa"] as unknown as string)).message).toBe("Falta stock. Revisa");
    expect(classifyFailure(httpError(404)).message).toBe("El servidor rechazó la acción.");
  });
});
