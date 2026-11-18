"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import ScanInput from "@/components/almacen/ScanInput";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import ReceiveTransferDialog from "@/components/warehouse-ops/transfers/ReceiveTransferDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { scanFeedback } from "@/lib/barcodeScanner";
import { toWriteResult } from "@/lib/offlineQueue";
import { OfflineUnavailableError, readWithSnapshot } from "@/lib/offlineStore";
import { formatDay } from "@/lib/purchaseOrders";
import {
  formatSavedAt,
  matchCodeLocally,
  pendingForTransfer,
  snapshotKey,
  WAREHOUSE_ACTION,
  warehouseAccess,
} from "@/lib/warehouseMode";
import { opsErrorMessage, transferUnits } from "@/lib/warehouseOps";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { listTransfers, type Transfer, type TransferOperationResult } from "@/services/warehouseOpsService";
import { listWarehouses } from "@/services/warehousesService";
import { invalidateInventoryAlerts } from "@/hooks/useInventoryAlerts";

// FEAT-24 H5-C — Recibir › Traslados en el celular (modo almacén, mockup vMovil
// «Recibir»): los traslados en camino hacia un almacén que el usuario opera y el
// mismo diálogo de recepción del escritorio, empezando en 0, con el escáner
// (cada escaneo suma 1). La recepción va por la cola sin conexión y lleva su
// operationId: reenviarla no duplica.

const TRANSFERS_KEY = "almacen-transfers";

export default function MobileTransferReceiveScreen() {
  const queryClient = useQueryClient();
  const { auth, hasPermission } = useAuth();
  const { snapshots, session, outbox, enqueue, syncedVersion } = useWarehouseQueue();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  const scope = useMyWarehouses();
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? "";
  const ready = Boolean(snapshots && session && companyId) && access.receiveTransfers;
  const [receiving, setReceiving] = useState<Transfer | null>(null);

  const online = () => navigator.onLine !== false;

  const transfersQuery = useQuery({
    queryKey: [TRANSFERS_KEY, companyId, "en_camino"],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "transfers", "en_camino"), () => listTransfers({ status: "en_camino" }), { online: online() }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const warehousesQuery = useQuery({
    queryKey: [TRANSFERS_KEY, companyId, "warehouses"],
    queryFn: () => readWithSnapshot(snapshots!, snapshotKey(session!, "warehouses"), () => listWarehouses(), { online: online() }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 60_000,
  });

  // Solo los que llegan a un almacén que el usuario opera (sin asignaciones, todos).
  const transfers = useMemo(
    () => (transfersQuery.data?.data ?? []).filter((transfer) => scope.canOperate(transfer.destinationInventoryId)),
    [transfersQuery.data, scope],
  );
  const variantIds = useMemo(() => [...new Set(transfers.flatMap((transfer) => transfer.lines.map((line) => line.variantId)))].sort(), [transfers]);
  // Códigos de los productos en camino: para leer el escáner sin señal.
  const variantsQuery = useQuery({
    queryKey: [TRANSFERS_KEY, companyId, "variants", variantIds],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "transfer-variants"), () => fetchVariantsByIds(variantIds, companyId), { online: online() }),
    enabled: ready && variantIds.length > 0,
    networkMode: "always",
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const variants = useMemo(() => variantsQuery.data?.data ?? [], [variantsQuery.data]);
  const warehouses = warehousesQuery.data?.data.warehouses ?? [];
  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Almacén";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, companyId] });
    void invalidateInventoryAlerts(queryClient);
  };

  useEffect(() => {
    if (syncedVersion <= 0) return;
    void queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, companyId] });
    void invalidateInventoryAlerts(queryClient);
  }, [syncedVersion, companyId, queryClient]);

  if (!access.receiveTransfers) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No puedes recibir traslados</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lo hacen Administrador, Operaciones y Almacén.</p>
      </div>
    );
  }

  const read = transfersQuery.data;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-tight">Traslados por recibir</h1>
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

      {!ready || transfersQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando traslados…</p>
      ) : transfersQuery.isError ? (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          {transfersQuery.error instanceof OfflineUnavailableError
            ? "Sin señal: los traslados en camino todavía no se descargaron en este celular."
            : opsErrorMessage(transfersQuery.error, "No se pudieron cargar los traslados.")}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void transfersQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : transfers.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No hay traslados en camino hacia tus almacenes.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {transfers.map((transfer) => {
            const queued = pendingForTransfer(outbox, transfer.id);
            const units = transferUnits(transfer);
            return (
              <li key={transfer.id}>
                <button
                  type="button"
                  disabled={queued}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left active:bg-muted disabled:opacity-70"
                  aria-label={`Recibir traslado ${transfer.number}`}
                  onClick={() => setReceiving(transfer)}
                >
                  <span className="min-w-0">
                    <span className="block font-mono font-semibold">{transfer.number}</span>
                    <span className="block text-sm">
                      {warehouseName(transfer.originInventoryId)} → {warehouseName(transfer.destinationInventoryId)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Despachado {formatDay(transfer.dispatchedAt ?? transfer.createdAt)}
                      {transfer.remissionGuide ? ` · guía ${transfer.remissionGuide}` : ""}
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
        <ReceiveTransferDialog
          transfer={receiving}
          companyId={companyId}
          originName={warehouseName(receiving.originInventoryId)}
          destinationName={warehouseName(receiving.destinationInventoryId)}
          fill="zero"
          onClose={() => setReceiving(null)}
          onReceived={() => {
            setReceiving(null);
            refresh();
          }}
          onConflict={refresh}
          submit={async (body) =>
            toWriteResult<TransferOperationResult>(
              await enqueue(WAREHOUSE_ACTION.transferReceive, { transferId: receiving.id, transferNumber: receiving.number, body }),
              "la recepción",
            )
          }
          renderScanner={(scan) => <ScanInput id="almacen-traslado-scan" label="Escanear (suma 1 a lo recibido)" onCode={scan} />}
          localLookup={(code) => matchCodeLocally(code, variants)}
          onFeedback={(kind) => scanFeedback(kind)}
        />
      ) : null}
    </div>
  );
}
