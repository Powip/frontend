import { isNetworkError, type RecordStore } from "./offlineStore";

// FEAT-24 H6-D (H6-D4) — cola de acciones del modo almacén. Cada acción que
// escribe (escaneo de picking, confirmar línea, completar, recibir) se guarda
// con un id que es su `Idempotency-Key` (uuid) y se envía en orden. Reglas:
//   - Sin señal: queda guardada y se envía al volver.
//   - Error de red o sin respuesta (timeout, 5xx): NO se reenvía a ciegas. El
//     backend todavía no deduplica por `Idempotency-Key` (llega con H6-A), así
//     que antes de reenviar se consulta el estado (`verify`: el picking o la
//     recepción) y solo se reenvía si no se aplicó. Lo mismo si la página se
//     recargó con una acción a medio enviar (estado `sending`).
//   - 4xx de negocio (409 «ya lo despachó otro», 400 «código que no es del
//     pedido»…): va a la bandeja «Para revisar» con el mensaje del servidor y la
//     cola sigue. Si el usuario estaba esperando esa acción en pantalla, se le
//     muestra a él y no se guarda.
//   - 401 / 429: no se aplicó; se reintenta más tarde con la misma clave.
// Solo se envían las acciones de la sesión actual (usuario y empresa): las de
// otra sesión del mismo celular quedan guardadas sin tocar.

export type QueueStatus = "pending" | "sending" | "uncertain" | "review";

export interface QueuedAction<P = unknown> {
  /** También es el `Idempotency-Key`. */
  id: string;
  kind: string;
  payload: P;
  companyId: string;
  userId: string;
  /** Orden de envío. */
  seq: number;
  createdAt: number;
  updatedAt: number;
  status: QueueStatus;
  attempts: number;
  /** Lo que `prepare` guardó antes del primer envío para poder verificar después. */
  checkpoint?: unknown;
  lastError?: string;
  httpStatus?: number;
}

export interface QueueSession {
  companyId: string;
  userId: string;
}

/** Memoria corta compartida por los manejadores (p. ej. el total tomado de un pedido). */
export interface QueueMemo {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export type VerifyResult<R = unknown> = { applied: true; result?: R } | { applied: false } | { conflict: string };

export interface ActionHandler<P = never, R = unknown> {
  send(payload: P, context: { idempotencyKey: string; checkpoint: unknown; memo: QueueMemo }): Promise<R>;
  /** Antes del primer envío: datos para verificar tras un envío sin respuesta (se guardan con la acción). */
  prepare?(payload: P, context: { memo: QueueMemo }): Promise<unknown>;
  /** Tras un envío sin respuesta: ¿el servidor ya la aplicó? Sin esto, reenviar es seguro. */
  verify?(payload: P, context: { checkpoint: unknown; memo: QueueMemo }): Promise<VerifyResult<R>>;
  /** Un error que en realidad deja la acción hecha (p. ej. 503 «el despacho quedó pendiente»). */
  appliedOnError?(error: unknown): { message: string } | null;
  onApplied?(payload: P, result: R | undefined, context: { memo: QueueMemo }): void;
}

export type EnqueueOutcome<R = unknown> =
  | { status: "done"; id: string; result?: R; message?: string }
  | { status: "queued"; id: string; reason: "offline" | "no_response" | "waiting" }
  | { status: "rejected"; id: string; message: string; httpStatus?: number };

export type FailureKind = "business" | "uncertain" | "retry" | "auth";

export interface Failure {
  kind: FailureKind;
  httpStatus?: number;
  message: string;
}

const DEFAULT_ERROR = "El servidor rechazó la acción.";

function serverMessage(error: unknown): string | null {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part.trim() !== "");
    return parts.length ? parts.map((part) => part.trim()).join(". ") : null;
  }
  return typeof message === "string" && message.trim() !== "" ? message.trim() : null;
}

/** Qué hacer con un error al enviar. */
export function classifyFailure(error: unknown): Failure {
  const candidate = error as { response?: { status?: unknown }; name?: unknown; code?: unknown; message?: unknown } | null;
  if (candidate?.name === "CanceledError" || candidate?.code === "ERR_CANCELED")
    return { kind: "retry", message: "La sesión estaba cambiando: se reintenta." };
  const status = typeof candidate?.response?.status === "number" ? candidate.response.status : undefined;
  if (status === undefined) {
    if (isNetworkError(error)) return { kind: "uncertain", message: "Sin respuesta del servidor." };
    const text = typeof candidate?.message === "string" && candidate.message ? candidate.message : DEFAULT_ERROR;
    return { kind: "business", message: text };
  }
  if (status === 401) return { kind: "auth", httpStatus: status, message: "La sesión venció: inicia sesión de nuevo." };
  if (status === 408) return { kind: "uncertain", httpStatus: status, message: "El servidor tardó demasiado." };
  if (status === 429) return { kind: "retry", httpStatus: status, message: "Demasiadas solicitudes: se reintenta." };
  if (status >= 500) return { kind: "uncertain", httpStatus: status, message: serverMessage(error) ?? "Error del servidor." };
  return { kind: "business", httpStatus: status, message: serverMessage(error) ?? DEFAULT_ERROR };
}

/** Error con la forma de un error de axios, para mostrar el rechazo con los helpers de siempre. */
export class QueueRejectedError extends Error {
  readonly response: { status?: number; data: { message: string } };
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "QueueRejectedError";
    this.response = { status: httpStatus, data: { message } };
  }
}

/** Lo que recibe una pantalla al escribir: hecho (con la respuesta, si la hubo) o guardado para después. */
export type WriteResult<R> = { status: "done"; result?: R; message?: string } | { status: "queued"; message: string };

/** Aviso para lo que quedó guardado. `subject`: «el escaneo 775», «la recepción»… */
export function queuedMessage(reason: "offline" | "no_response" | "waiting", subject: string): string {
  if (reason === "offline") return `Sin señal: ${subject} quedó guardado y se envía al volver la conexión.`;
  if (reason === "no_response") return `El servidor no respondió: ${subject} quedó guardado y se verifica antes de reenviarlo.`;
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} quedó en cola detrás de otras acciones sin enviar.`;
}

/** Para las pantallas: «hecho» o «guardado»; un rechazo se lanza como error (con la forma de axios). */
export function toWriteResult<R>(outcome: EnqueueOutcome<R>, subject: string): WriteResult<R> {
  if (outcome.status === "rejected") throw new QueueRejectedError(outcome.message, outcome.httpStatus);
  if (outcome.status === "queued") return { status: "queued", message: queuedMessage(outcome.reason, subject) };
  return { status: "done", result: outcome.result, ...(outcome.message ? { message: outcome.message } : {}) };
}

export interface FlushReport {
  /** Acciones aplicadas (enviadas o verificadas). */
  applied: number;
  /** Acciones que pasaron a «Para revisar». */
  review: number;
  /** Por qué se cortó el envío (`null` = se mandó todo lo que había). */
  stopped: "offline" | "no_session" | FailureKind | null;
}

export interface OfflineQueue {
  enqueue<R = unknown>(kind: string, payload: unknown): Promise<EnqueueOutcome<R>>;
  flush(): Promise<FlushReport>;
  /** Todas las acciones guardadas, en orden de envío. */
  list(): Promise<QueuedAction[]>;
  /** Descarta una acción de «Para revisar». */
  discard(id: string): Promise<void>;
  /** Vuelve a intentar una acción de «Para revisar» (con una clave nueva: es un intento nuevo). */
  retry(id: string): Promise<void>;
}

export interface OfflineQueueOptions {
  store: RecordStore<QueuedAction>;
  handlers: Record<string, ActionHandler<never, unknown>>;
  session: () => QueueSession | null;
  isOnline?: () => boolean;
  newId?: () => string;
  now?: () => number;
  /** Candado entre pestañas (Web Locks); siempre hay además uno dentro de la pestaña. */
  crossTabLock?: <T>(work: () => Promise<T>) => Promise<T>;
  /** Avisa cada vez que cambia lo guardado. `synced` = se aplicó una acción que nadie esperaba en pantalla. */
  onChange?: (event: { synced: boolean }) => void;
  memoTtlMs?: number;
}

const bySeq = (a: QueuedAction, b: QueuedAction) => a.seq - b.seq || a.createdAt - b.createdAt;

export function createMemo(ttlMs: number, now: () => number): QueueMemo {
  const values = new Map<string, { value: unknown; at: number }>();
  return {
    get<T>(key: string) {
      const entry = values.get(key);
      if (!entry) return undefined;
      if (now() - entry.at > ttlMs) {
        values.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set(key, value) {
      values.set(key, { value, at: now() });
    },
    delete(key) {
      values.delete(key);
    },
  };
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Respaldo (navegadores viejos sin randomUUID): uuid v4 con getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Candado entre pestañas con Web Locks cuando existe; si no, no hace nada extra. */
export function webLock(name: string): <T>(work: () => Promise<T>) => Promise<T> {
  return <T>(work: () => Promise<T>) => {
    const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    if (!locks?.request) return work();
    return locks.request(name, () => work()) as Promise<T>;
  };
}

export function createOfflineQueue(options: OfflineQueueOptions): OfflineQueue {
  const { store, handlers, session } = options;
  const isOnline = options.isOnline ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const newId = options.newId ?? defaultId;
  const now = options.now ?? Date.now;
  const crossTab = options.crossTabLock ?? (<T>(work: () => Promise<T>) => work());
  const memo = createMemo(options.memoTtlMs ?? 60_000, now);
  const waiters = new Map<string, (outcome: EnqueueOutcome<unknown>) => void>();
  let chain: Promise<unknown> = Promise.resolve();
  // El orden se decide en memoria después de leer lo guardado: dos acciones seguidas nunca comparten número.
  let lastSeq = 0;
  const nextSeq = (all: QueuedAction[]) => {
    lastSeq = Math.max(lastSeq, ...all.map((action) => action.seq)) + 1;
    return lastSeq;
  };

  const notify = (synced = false) => options.onChange?.({ synced });

  const locked = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(() => crossTab(work));
    chain = next.catch(() => undefined);
    return next;
  };

  const settle = (id: string, outcome: EnqueueOutcome<unknown>): boolean => {
    const waiter = waiters.get(id);
    if (!waiter) return false;
    waiters.delete(id);
    waiter(outcome);
    return true;
  };

  async function finish(action: QueuedAction, handler: ActionHandler<never, unknown>, result: unknown, message?: string) {
    await store.delete(action.id);
    handler.onApplied?.(action.payload as never, result, { memo });
    const waited = settle(action.id, { status: "done", id: action.id, result, ...(message ? { message } : {}) });
    notify(!waited);
  }

  async function reject(action: QueuedAction, failure: { message: string; httpStatus?: number }): Promise<"review" | "rejected"> {
    if (waiters.has(action.id)) {
      // El usuario la está esperando en pantalla: se le muestra a él y no se guarda.
      await store.delete(action.id);
      settle(action.id, { status: "rejected", id: action.id, message: failure.message, httpStatus: failure.httpStatus });
      notify();
      return "rejected";
    }
    await store.put({
      ...action,
      status: "review",
      lastError: failure.message,
      httpStatus: failure.httpStatus,
      updatedAt: now(),
    });
    notify();
    return "review";
  }

  async function keep(action: QueuedAction, status: QueueStatus, failure: Failure) {
    await store.put({ ...action, status, lastError: failure.message, httpStatus: failure.httpStatus, updatedAt: now() });
    notify();
  }

  /** Procesa una acción. Devuelve por qué hay que cortar el envío, o `null` para seguir con la próxima. */
  async function process(action: QueuedAction, report: FlushReport): Promise<FailureKind | null> {
    const handler = handlers[action.kind];
    if (!handler) {
      if ((await reject(action, { message: "Esta acción ya no existe en esta versión de la app." })) === "review") report.review += 1;
      return null;
    }
    const payload = action.payload as never;

    // 1) Un envío anterior quedó sin respuesta (o la página se recargó a mitad): primero se consulta el estado.
    if ((action.status === "sending" || action.status === "uncertain") && handler.verify) {
      let verdict: VerifyResult<unknown>;
      try {
        verdict = await handler.verify(payload, { checkpoint: action.checkpoint, memo });
      } catch (error) {
        const failure = classifyFailure(error);
        if (failure.kind === "business") {
          if ((await reject(action, failure)) === "review") report.review += 1;
          return null;
        }
        await keep(action, "uncertain", failure);
        return failure.kind;
      }
      if ("conflict" in verdict) {
        if ((await reject(action, { message: verdict.conflict })) === "review") report.review += 1;
        return null;
      }
      if (verdict.applied) {
        await finish(action, handler, verdict.result);
        report.applied += 1;
        return null;
      }
      // No se aplicó: se reenvía con la misma clave.
    }

    // 2) Lo necesario para verificar después, una sola vez y antes del primer envío.
    let checkpoint = action.checkpoint;
    if (handler.prepare && checkpoint === undefined) {
      try {
        checkpoint = (await handler.prepare(payload, { memo })) ?? null;
      } catch (error) {
        const failure = classifyFailure(error);
        if (failure.kind === "business") {
          if ((await reject(action, failure)) === "review") report.review += 1;
          return null;
        }
        // No se envió nada: sigue pendiente.
        await keep(action, "pending", failure);
        return failure.kind;
      }
    }

    // 3) Se marca «enviando» ANTES de enviar: si la página se cae, al volver se verifica en vez de reenviar.
    const sending: QueuedAction = { ...action, checkpoint, status: "sending", attempts: action.attempts + 1, updatedAt: now() };
    await store.put(sending);

    try {
      const result = await handler.send(payload, { idempotencyKey: action.id, checkpoint, memo });
      await finish(sending, handler, result);
      report.applied += 1;
      return null;
    } catch (error) {
      const applied = handler.appliedOnError?.(error);
      if (applied) {
        await finish(sending, handler, undefined, applied.message);
        report.applied += 1;
        return null;
      }
      const failure = classifyFailure(error);
      if (failure.kind === "business") {
        if ((await reject(sending, failure)) === "review") report.review += 1;
        return null;
      }
      // Sin respuesta: quizá se aplicó (se verifica antes de reenviar). 401/429: el servidor no la aplicó.
      await keep(sending, failure.kind === "uncertain" ? "uncertain" : "pending", failure);
      return failure.kind;
    }
  }

  const sameSession = (action: QueuedAction, current: QueueSession) =>
    action.companyId === current.companyId && action.userId === current.userId;

  function flush(): Promise<FlushReport> {
    return locked(async () => {
      const report: FlushReport = { applied: 0, review: 0, stopped: null };
      const current = session();
      const all = (await store.getAll()).sort(bySeq);
      const mine = current ? all.filter((action) => sameSession(action, current) && action.status !== "review") : [];
      const attempted = new Set<string>();

      if (!current) report.stopped = "no_session";
      else if (!isOnline()) report.stopped = "offline";
      else {
        for (const action of mine) {
          attempted.add(action.id);
          const stop = await process(action, report);
          if (stop) {
            report.stopped = stop;
            break;
          }
        }
      }
      // Lo que quedó sin resolver en esta pasada: quien lo esperaba sigue con su trabajo (se envía después).
      for (const action of mine) {
        const reason = attempted.has(action.id) ? "no_response" : isOnline() ? "waiting" : "offline";
        settle(action.id, { status: "queued", id: action.id, reason });
      }
      return report;
    });
  }

  async function enqueue<R>(kind: string, payload: unknown): Promise<EnqueueOutcome<R>> {
    const current = session();
    if (!current) throw new Error("No hay una sesión activa para guardar la acción.");
    if (!handlers[kind]) throw new Error(`Acción desconocida: ${kind}`);
    const id = newId();
    const seq = nextSeq(await store.getAll());
    const at = now();
    await store.put({
      id,
      kind,
      payload,
      companyId: current.companyId,
      userId: current.userId,
      seq,
      createdAt: at,
      updatedAt: at,
      status: "pending",
      attempts: 0,
    });
    notify();
    if (!isOnline()) return { status: "queued", id, reason: "offline" };
    const outcome = new Promise<EnqueueOutcome<R>>((resolve) => {
      waiters.set(id, resolve as (outcome: EnqueueOutcome<unknown>) => void);
    });
    void flush();
    return outcome;
  }

  return {
    enqueue,
    flush,
    async list() {
      return (await store.getAll()).sort(bySeq);
    },
    async discard(id) {
      await locked(async () => {
        const action = await store.get(id);
        if (action?.status === "review") await store.delete(id);
      });
      notify();
    },
    async retry(id) {
      await locked(async () => {
        const action = await store.get(id);
        if (action?.status !== "review") return;
        await store.delete(id);
        // Va al final de la cola con una clave nueva; el checkpoint se vuelve a tomar.
        const seq = nextSeq(await store.getAll());
        await store.put({
          ...action,
          id: newId(),
          seq,
          status: "pending",
          attempts: 0,
          checkpoint: undefined,
          lastError: undefined,
          httpStatus: undefined,
          updatedAt: now(),
        });
      });
      notify();
    },
  };
}
