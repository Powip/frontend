"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import ScanInput from "@/components/almacen/ScanInput";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import ReceiveReturnDialog from "@/components/inventory/receptions/ReceiveReturnDialog";
import { makeVariantLabeler, orderLabel } from "@/components/inventory/receptions/receptionLabels";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { scanFeedback } from "@/lib/barcodeScanner";
import { toWriteResult } from "@/lib/offlineQueue";
import { OfflineUnavailableError, readWithSnapshot } from "@/lib/offlineStore";
import { receptionVariantIds } from "@/lib/returnReception";
import {
  formatSavedAt,
  matchCodeLocally,
  pendingForReception,
  snapshotKey,
  WAREHOUSE_ACTION,
  warehouseAccess,
} from "@/lib/warehouseMode";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { listReturnReceptions, listWarehouses, type ReturnReception } from "@/services/warehousesService";

// FEAT-24 H6-D (H6-D3) — Recibir › Devoluciones en el celular: la bandeja «por
// recibir» de Inventario › Recepciones (H2-F) y el mismo diálogo de recepción,
// con el escáner de cámara. La recepción va por la cola sin conexión. Sin
// señal se ve la última bandeja descargada y los códigos se resuelven con los
// productos ya descargados.

const RETURNS_KEY = "almacen-returns";

export default function MobileReturnsScreen() {
  const queryClient = useQueryClient();
  const { auth, hasPermission } = useAuth();
  const { snapshots, session, outbox, enqueue, syncedVersion } = useWarehouseQueue();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? "";
  const ready = Boolean(snapshots && session && companyId) && access.receiveReturns;
  const [receiving, setReceiving] = useState<ReturnReception | null>(null);

  const online = () => navigator.onLine !== false;

  const pendingQuery = useQuery({
    queryKey: [RETURNS_KEY, companyId, "por_recibir"],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "returns", "por_recibir"), () => listReturnReceptions("por_recibir"), {
        online: online(),
      }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const warehousesQuery = useQuery({
    queryKey: [RETURNS_KEY, companyId, "warehouses"],
    queryFn: () => readWithSnapshot(snapshots!, snapshotKey(session!, "warehouses"), () => listWarehouses(), { online: online() }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 60_000,
  });

  const receptions = useMemo(() => pendingQuery.data?.data ?? [], [pendingQuery.data]);
  const variantIds = useMemo(() => receptionVariantIds(receptions), [receptions]);
  // Nombres, SKU y códigos de los productos: para mostrar y para leer códigos sin señal.
  const variantsQuery = useQuery({
    queryKey: [RETURNS_KEY, companyId, "variants", variantIds],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "return-variants"), () => fetchVariantsByIds(variantIds, companyId), {
        online: online(),
      }),
    enabled: ready && variantIds.length > 0,
    networkMode: "always",
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const variants = useMemo(() => variantsQuery.data?.data ?? [], [variantsQuery.data]);
  const label = useMemo(
    () => makeVariantLabeler(new Map(variants.map((variant) => [variant.id.toLowerCase(), variant]))),
    [variants],
  );
  const warehouses = warehousesQuery.data?.data.warehouses ?? [];
  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Almacén del pedido";

  const refresh = () => void queryClient.invalidateQueries({ queryKey: [RETURNS_KEY, companyId] });

  useEffect(() => {
    if (syncedVersion > 0) void queryClient.invalidateQueries({ queryKey: [RETURNS_KEY, companyId] });
  }, [syncedVersion, companyId, queryClient]);

  if (!access.receiveReturns) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No puedes recibir devoluciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lo hacen Administrador, Operaciones y Almacén.</p>
      </div>
    );
  }

  const read = pendingQuery.data;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-tight">Devoluciones por recibir</h1>
      {read ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {read.fromCache ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <CloudOff className="h-3 w-3" aria-hidden="true" />
              Sin señal: datos guardados
            </span>
          ) : null}
          Última actualización: {formatSavedAt(read.savedAt)}
        </p>
      ) : null}

      {!ready || pendingQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando devoluciones…</p>
      ) : pendingQuery.isError ? (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          {pendingQuery.error instanceof OfflineUnavailableError
            ? "Sin señal: la bandeja de devoluciones todavía no se descargó en este celular."
            : warehouseErrorMessage(pendingQuery.error, "No se pudieron cargar las devoluciones.")}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void pendingQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : receptions.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No hay devoluciones por recibir.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {receptions.map((reception) => {
            const queued = pendingForReception(outbox, reception.id);
            const units = reception.lines.reduce((sum, line) => sum + line.quantity, 0);
            return (
              <li key={reception.id}>
                <button
                  type="button"
                  disabled={queued}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left active:bg-muted disabled:opacity-70"
                  aria-label={`Recibir devolución ${orderLabel(reception)}`}
                  onClick={() => setReceiving(reception)}
                >
                  <span className="min-w-0">
                    <span className="block font-mono font-semibold">{orderLabel(reception)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {warehouseName(reception.inventoryId)} · {formatPeruDateTime(reception.createdAt)}
                    </span>
                    {queued ? (
                      <span className="block text-xs font-medium text-amber-800 dark:text-amber-200">Recepción guardada: se envía al volver la señal.</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">{units === 1 ? "1 unidad" : `${units} unidades`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {receiving ? (
        <ReceiveReturnDialog
          reception={receiving}
          companyId={companyId}
          warehouses={warehouses}
          label={label}
          onClose={() => setReceiving(null)}
          onReceived={() => {
            setReceiving(null);
            refresh();
          }}
          onConflict={refresh}
          submit={async (body) =>
            toWriteResult<ReturnReception>(
              await enqueue(WAREHOUSE_ACTION.returnReceive, { receptionId: receiving.id, orderLabel: orderLabel(receiving), body }),
              "la recepción",
            )
          }
          renderScanner={(scan) => <ScanInput id="almacen-recibir-scan" label="Escanear (suma 1 a stock)" onCode={scan} />}
          localLookup={(code) => matchCodeLocally(code, variants)}
          onFeedback={(kind) => scanFeedback(kind)}
        />
      ) : null}
    </div>
  );
}
