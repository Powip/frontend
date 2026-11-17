"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import {
  createOfflineQueue,
  webLock,
  type EnqueueOutcome,
  type OfflineQueue,
  type QueuedAction,
  type QueueSession,
} from "@/lib/offlineQueue";
import {
  indexedDbAvailable,
  indexedDbStore,
  memoryStore,
  QUEUE_STORE,
  SNAPSHOT_STORE,
  type RecordStore,
  type Snapshot,
} from "@/lib/offlineStore";
import { splitQueue, warehouseActionHandlers } from "@/lib/warehouseMode";

// FEAT-24 H6-D (H6-D4) — la cola sin conexión del modo almacén para las
// pantallas de /almacen: guarda en IndexedDB, envía al volver la señal (y cada
// 20 s mientras haya algo pendiente) y expone «Por enviar» y «Para revisar».

const RETRY_EVERY_MS = 20_000;

interface WarehouseQueueValue {
  /** IndexedDB abierta (o la copia en memoria si no hay). */
  ready: boolean;
  /** false = sin IndexedDB: lo guardado se pierde al recargar. */
  persistent: boolean;
  online: boolean;
  session: QueueSession | null;
  outbox: QueuedAction[];
  review: QueuedAction[];
  otherSessions: number;
  /** Cambia cada vez que se aplica algo que nadie esperaba en pantalla (para volver a leer). */
  syncedVersion: number;
  syncing: boolean;
  enqueue<R = unknown>(kind: string, payload: unknown): Promise<EnqueueOutcome<R>>;
  flush(): Promise<void>;
  discard(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  /** Lo último descargado; `null` hasta que el almacenamiento esté listo. */
  snapshots: RecordStore<Snapshot> | null;
}

const WarehouseQueueContext = createContext<WarehouseQueueValue | null>(null);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

export function WarehouseQueueProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const online = useOnline();
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? null;
  const userId = auth?.user?.id ?? null;
  const session = useMemo<QueueSession | null>(
    () => (companyId && userId ? { companyId, userId } : null),
    [companyId, userId],
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const pending = useRef(deferred<OfflineQueue>());
  const [queue, setQueue] = useState<OfflineQueue | null>(null);
  const [snapshots, setSnapshots] = useState<RecordStore<Snapshot> | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [syncedVersion, setSyncedVersion] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const usable = await indexedDbAvailable();
      const queueStore = usable ? indexedDbStore<QueuedAction>(QUEUE_STORE) : memoryStore<QueuedAction>((action) => action.id);
      const snapshotStore = usable ? indexedDbStore<Snapshot>(SNAPSHOT_STORE) : memoryStore<Snapshot>((row) => row.key);
      let created: OfflineQueue | null = null;
      const refresh = () => {
        if (!created) return;
        void created
          .list()
          .then((list) => {
            if (!cancelled) setActions(list);
          })
          .catch(() => undefined);
      };
      created = createOfflineQueue({
        store: queueStore,
        handlers: warehouseActionHandlers(),
        session: () => sessionRef.current,
        crossTabLock: webLock("powip-almacen-cola"),
        onChange: ({ synced }) => {
          if (synced && !cancelled) setSyncedVersion((version) => version + 1);
          refresh();
        },
      });
      if (cancelled) return;
      setPersistent(usable);
      setSnapshots(snapshotStore);
      setQueue(created);
      pending.current.resolve(created);
      refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(async () => {
    const current = await pending.current.promise;
    setSyncing(true);
    try {
      await current.flush();
    } finally {
      setSyncing(false);
    }
  }, []);

  const split = useMemo(() => splitQueue(actions, session), [actions, session]);
  const hasOutbox = split.outbox.length > 0;

  // Al volver la señal, al abrir la app con la sesión lista y cada tanto mientras quede algo por enviar.
  useEffect(() => {
    if (!queue || !online || !session) return;
    void flush();
  }, [queue, online, session, flush]);

  useEffect(() => {
    if (!queue || !online || !hasOutbox) return;
    const timer = window.setInterval(() => void flush(), RETRY_EVERY_MS);
    const visible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [queue, online, hasOutbox, flush]);

  const value = useMemo<WarehouseQueueValue>(
    () => ({
      ready: queue !== null,
      persistent,
      online,
      session,
      outbox: split.outbox,
      review: split.review,
      otherSessions: split.otherSessions,
      syncedVersion,
      syncing,
      enqueue: async <R,>(kind: string, payload: unknown) => (await pending.current.promise).enqueue<R>(kind, payload),
      flush,
      discard: async (id: string) => (await pending.current.promise).discard(id),
      retry: async (id: string) => {
        await (await pending.current.promise).retry(id);
        if (navigator.onLine !== false) await flush();
      },
      snapshots,
    }),
    [queue, persistent, online, session, split, syncedVersion, syncing, flush, snapshots],
  );

  return <WarehouseQueueContext.Provider value={value}>{children}</WarehouseQueueContext.Provider>;
}

export function useWarehouseQueue(): WarehouseQueueValue {
  const value = useContext(WarehouseQueueContext);
  if (!value) throw new Error("useWarehouseQueue se usa dentro de WarehouseQueueProvider.");
  return value;
}
