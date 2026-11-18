"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import { toast } from "sonner";
import ScanInput from "@/components/almacen/ScanInput";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { scanFeedback } from "@/lib/barcodeScanner";
import { toWriteResult } from "@/lib/offlineQueue";
import { OfflineUnavailableError, readWithSnapshot, type SnapshotRead } from "@/lib/offlineStore";
import { formatDay } from "@/lib/purchaseOrders";
import {
  formatSavedAt,
  matchCodeLocally,
  pendingCountScans,
  snapshotKey,
  WAREHOUSE_ACTION,
  warehouseAccess,
} from "@/lib/warehouseMode";
import { COUNT_SCOPE_LABEL, countProgress, lineLabel, mergeCountEntries, opsErrorMessage } from "@/lib/warehouseOps";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { closeCount, getCount, listCounts, type CountEntriesResult, type StockCount } from "@/services/warehouseOpsService";
import { listWarehouses } from "@/services/warehousesService";

// FEAT-24 H5-C — Contar en el celular (modo almacén, mockup vMovil «Contar»):
// las tomas de inventario en curso de los almacenes que el usuario opera. Cada
// escaneo suma 1 al contado (el código va tal cual y lo resuelve el servidor) y
// va por la cola sin conexión con su propia clave: un reenvío no cuenta dos
// veces. Aquí nunca se muestra el stock del sistema: solo lo contado. Al
// terminar se envía a validación.

const COUNTS_KEY = "almacen-counts";

export default function MobileCountScreen() {
  const { auth, hasPermission } = useAuth();
  const { snapshots, session } = useWarehouseQueue();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  const scope = useMyWarehouses();
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? "";
  const ready = Boolean(snapshots && session && companyId) && access.count;
  const [selected, setSelected] = useState<string | null>(null);

  const online = () => navigator.onLine !== false;

  const countsQuery = useQuery({
    queryKey: [COUNTS_KEY, companyId, "en_curso"],
    queryFn: () => readWithSnapshot(snapshots!, snapshotKey(session!, "counts", "en_curso"), () => listCounts({ status: "en_curso" }), { online: online() }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const warehousesQuery = useQuery({
    queryKey: [COUNTS_KEY, companyId, "warehouses"],
    queryFn: () => readWithSnapshot(snapshots!, snapshotKey(session!, "warehouses"), () => listWarehouses(), { online: online() }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 60_000,
  });
  const counts = useMemo(() => (countsQuery.data?.data ?? []).filter((count) => scope.canOperate(count.inventoryId)), [countsQuery.data, scope]);
  const warehouses = warehousesQuery.data?.data.warehouses ?? [];
  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Almacén";

  if (!access.count) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No puedes contar inventario</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lo hacen Administrador, Operaciones y Almacén.</p>
      </div>
    );
  }

  const chosen = counts.find((count) => count.id === selected);
  if (chosen) return <CountScan key={chosen.id} count={chosen} companyId={companyId} warehouseName={warehouseName(chosen.inventoryId)} onBack={() => setSelected(null)} />;

  const read = countsQuery.data;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-tight">Contar</h1>
      {read ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {read.fromCache ? <OfflineBadge /> : null}
          Última actualización: {formatSavedAt(read.savedAt)}
        </p>
      ) : null}
      {!ready || countsQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando conteos…</p>
      ) : countsQuery.isError ? (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          {countsQuery.error instanceof OfflineUnavailableError
            ? "Sin señal: los conteos en curso todavía no se descargaron en este celular."
            : opsErrorMessage(countsQuery.error, "No se pudieron cargar los conteos.")}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void countsQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : counts.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          No hay una toma de inventario en curso en tus almacenes. La inicia Administración u Operaciones desde Inventario › Conteos.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {counts.map((count) => {
            const progress = countProgress(count);
            return (
              <li key={count.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left active:bg-muted"
                  aria-label={`Contar ${count.number}`}
                  onClick={() => setSelected(count.id)}
                >
                  <span className="min-w-0">
                    <span className="block font-mono font-semibold">{count.number}</span>
                    <span className="block text-sm">{warehouseName(count.inventoryId)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {COUNT_SCOPE_LABEL[count.scope] ?? count.scope} · desde {formatDay(count.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {progress.counted} / {progress.total}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OfflineBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <CloudOff className="h-3 w-3" aria-hidden="true" />
      Sin señal: datos guardados
    </span>
  );
}

function CountScan({ count, companyId, warehouseName, onBack }: { count: StockCount; companyId: string; warehouseName: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { snapshots, session, outbox, enqueue, syncedVersion, online } = useWarehouseQueue();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scans = useRef<Promise<void>>(Promise.resolve());
  const key = useMemo(() => [COUNTS_KEY, companyId, "count", count.id], [companyId, count.id]);

  const detailQuery = useQuery({
    queryKey: key,
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "count", count.id), () => getCount(count.id), { online: navigator.onLine !== false }),
    enabled: Boolean(snapshots && session),
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const detail = detailQuery.data?.data;
  const lines = useMemo(() => detail?.lines ?? [], [detail]);
  const variantIds = useMemo(() => [...new Set(lines.map((line) => line.variantId))].sort(), [lines]);
  // Códigos de los productos del conteo: para mostrar lo escaneado sin señal.
  const variantsQuery = useQuery({
    queryKey: [COUNTS_KEY, companyId, "variants", count.id, variantIds],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "count-variants", count.id), () => fetchVariantsByIds(variantIds, companyId), {
        online: navigator.onLine !== false,
      }),
    enabled: Boolean(snapshots && session) && variantIds.length > 0,
    networkMode: "always",
    retry: false,
    staleTime: 5 * 60_000,
  });
  const variants = useMemo(() => variantsQuery.data?.data ?? [], [variantsQuery.data]);

  const pendingScans = pendingCountScans(outbox, count.id);
  // Lo escaneado sin enviar, por producto (si el código se reconoce con lo ya descargado).
  const pendingByVariant = useMemo(() => {
    const totals = new Map<string, number>();
    for (const scan of pendingScans) {
      const matches = matchCodeLocally(scan.code, variants);
      if (matches.length === 1) totals.set(matches[0].variantId, (totals.get(matches[0].variantId) ?? 0) + 1);
    }
    return totals;
  }, [pendingScans, variants]);

  useEffect(() => {
    if (syncedVersion > 0) void queryClient.invalidateQueries({ queryKey: key });
  }, [syncedVersion, key, queryClient]);

  const applyResult = (result: CountEntriesResult) => {
    queryClient.setQueryData<SnapshotRead<StockCount>>(key, (current) => (current ? { ...current, data: mergeCountEntries(current.data, result.applied) } : current));
  };

  const processScan = async (code: string) => {
    try {
      const written = toWriteResult<CountEntriesResult>(
        await enqueue(WAREHOUSE_ACTION.countEntry, { countId: count.id, countNumber: count.number, code }),
        `el escaneo ${code}`,
      );
      setError(null);
      if (written.status === "queued") {
        setInfo(written.message);
        scanFeedback("ok");
        return;
      }
      if (written.result) applyResult(written.result);
      const applied = written.result?.applied[0];
      const line = applied ? lines.find((candidate) => candidate.id === applied.lineId) : undefined;
      setInfo(written.result?.duplicate ? "Ese escaneo ya estaba registrado." : `+1: ${line ? lineLabel(line) : code}${applied ? ` (contado ${applied.counted})` : ""}`);
      scanFeedback("ok");
    } catch (failure) {
      setInfo(null);
      setError(opsErrorMessage(failure, `No se registró el escaneo ${code}.`));
      scanFeedback("error");
    }
  };

  const scan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    scans.current = scans.current.then(() => processScan(code));
  };

  const close = useMutation({
    mutationFn: () => closeCount(count.id),
    onSuccess: () => {
      toast.success(`${count.number} enviado a validación`);
      void queryClient.invalidateQueries({ queryKey: [COUNTS_KEY, companyId] });
      onBack();
    },
    onError: (failure) => setError(opsErrorMessage(failure, "No se pudo enviar a validación.")),
  });

  const counted = lines.filter((line) => line.counted !== null && line.counted !== undefined).length;
  const canClose = online && pendingScans.length === 0 && !close.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight">{count.number}</h1>
          <p className="text-xs text-muted-foreground">
            {warehouseName} · cada escaneo suma 1 al contado
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Otros conteos
        </Button>
      </div>
      {detailQuery.data?.fromCache ? (
        <p className="text-xs text-muted-foreground">
          <OfflineBadge /> {formatSavedAt(detailQuery.data.savedAt)}
        </p>
      ) : null}

      <ScanInput id="almacen-conteo-scan" label="Escanea cada unidad del estante" onCode={scan} />
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-sm text-teal-700 dark:text-teal-300">
          {info}
        </p>
      ) : null}
      {pendingScans.length > 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {pendingScans.length === 1 ? "1 escaneo guardado" : `${pendingScans.length} escaneos guardados`} en el celular: se envían al volver la señal.
        </p>
      ) : null}

      {detailQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando productos…</p>
      ) : detailQuery.isError ? (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          {detailQuery.error instanceof OfflineUnavailableError
            ? "Sin señal: este conteo todavía no se descargó en este celular. Igual puedes escanear: se guarda y se envía después."
            : opsErrorMessage(detailQuery.error, "No se pudo cargar el conteo.")}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {counted} de {lines.length} productos contados
          </p>
          <ul className="divide-y rounded-md border">
            {lines.map((line) => {
              const pending = pendingByVariant.get(line.variantId) ?? 0;
              return (
                <li key={line.id} className="flex items-center justify-between gap-3 px-4 py-2" data-testid={`mobile-count-line-${line.id}`}>
                  <span className="min-w-0">
                    <span className="block text-sm">{lineLabel(line)}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{line.sku}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-semibold tabular-nums">{(line.counted ?? 0) + pending}</span>
                    {pending > 0 ? <span className="block text-xs text-amber-700 dark:text-amber-300">{pending} sin enviar</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Button type="button" className="w-full" disabled={!canClose} onClick={() => close.mutate()}>
        {close.isPending ? "Enviando…" : "Terminar y enviar a validación"}
      </Button>
      {!online || pendingScans.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">Para terminar hace falta señal y que no queden escaneos sin enviar.</p>
      ) : null}
    </div>
  );
}
