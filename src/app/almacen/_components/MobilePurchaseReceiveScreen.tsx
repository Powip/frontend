"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff } from "lucide-react";
import ScanInput from "@/components/almacen/ScanInput";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import ReceivePurchaseOrderDialog from "@/components/compras/ReceivePurchaseOrderDialog";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { scanFeedback } from "@/lib/barcodeScanner";
import { toWriteResult } from "@/lib/offlineQueue";
import { OfflineUnavailableError, readWithSnapshot } from "@/lib/offlineStore";
import { formatDay, PURCHASE_STATUS_LABEL } from "@/lib/purchaseOrders";
import {
  formatSavedAt,
  matchCodeLocally,
  pendingForPurchaseOrder,
  snapshotKey,
  WAREHOUSE_ACTION,
  warehouseAccess,
} from "@/lib/warehouseMode";
import { listPurchaseOrders, type PurchaseOrder, type ReceivePurchaseOrderResult } from "@/services/purchasesService";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { listWarehouses } from "@/services/warehousesService";

// FEAT-24 H3-E — Recibir › Órdenes de compra en el celular (modo almacén): las
// OC pedidas o recibidas en parte, y el mismo diálogo de recepción del
// escritorio empezando en 0, con el escáner de cámara (cada escaneo suma 1). La
// recepción va por la cola sin conexión (como las devoluciones): sin señal se
// ve la última lista descargada y los códigos se resuelven con los productos ya
// descargados. Cada recepción lleva su operationId: reenviarla no duplica.

const PURCHASES_KEY = "almacen-purchase-orders";
/** Hasta cuántas OC de cada estado se descargan. */
const LIST_LIMIT = 100;

async function listReceivableOrders(): Promise<PurchaseOrder[]> {
  const [ordered, partial] = await Promise.all([
    listPurchaseOrders({ status: "PEDIDA", limit: LIST_LIMIT }),
    listPurchaseOrders({ status: "RECIBIDA_PARCIAL", limit: LIST_LIMIT }),
  ]);
  // Primero las que ya empezaron a llegar; después, las más viejas.
  return [...partial.items, ...ordered.items.slice().reverse()];
}

export default function MobilePurchaseReceiveScreen() {
  const queryClient = useQueryClient();
  const { auth, hasPermission } = useAuth();
  const { snapshots, session, outbox, enqueue, syncedVersion } = useWarehouseQueue();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? "";
  const ready = Boolean(snapshots && session && companyId) && access.receivePurchases;
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);

  const online = () => navigator.onLine !== false;

  const ordersQuery = useQuery({
    queryKey: [PURCHASES_KEY, companyId, "por_recibir"],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "purchase-orders", "por_recibir"), () => listReceivableOrders(), {
        online: online(),
      }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const warehousesQuery = useQuery({
    queryKey: [PURCHASES_KEY, companyId, "warehouses"],
    queryFn: () => readWithSnapshot(snapshots!, snapshotKey(session!, "warehouses"), () => listWarehouses(), { online: online() }),
    enabled: ready,
    networkMode: "always",
    retry: false,
    staleTime: 60_000,
  });

  const orders = useMemo(() => ordersQuery.data?.data ?? [], [ordersQuery.data]);
  const variantIds = useMemo(
    () => [...new Set(orders.flatMap((order) => order.lines.map((line) => line.variantId)))].sort(),
    [orders],
  );
  // Códigos de los productos de las compras: para leer el escáner sin señal.
  const variantsQuery = useQuery({
    queryKey: [PURCHASES_KEY, companyId, "variants", variantIds],
    queryFn: () =>
      readWithSnapshot(snapshots!, snapshotKey(session!, "purchase-variants"), () => fetchVariantsByIds(variantIds, companyId), {
        online: online(),
      }),
    enabled: ready && variantIds.length > 0,
    networkMode: "always",
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const variants = useMemo(() => variantsQuery.data?.data ?? [], [variantsQuery.data]);
  const warehouses = warehousesQuery.data?.data.warehouses ?? [];
  const warehouseName = (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? "Almacén";

  const refresh = () => void queryClient.invalidateQueries({ queryKey: [PURCHASES_KEY, companyId] });

  useEffect(() => {
    if (syncedVersion > 0) void queryClient.invalidateQueries({ queryKey: [PURCHASES_KEY, companyId] });
  }, [syncedVersion, companyId, queryClient]);

  if (!access.receivePurchases) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No puedes recibir compras</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lo hacen Administrador, Operaciones y Almacén.</p>
      </div>
    );
  }

  const read = ordersQuery.data;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-tight">Compras por recibir</h1>
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

      {!ready || ordersQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando compras…</p>
      ) : ordersQuery.isError ? (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          {ordersQuery.error instanceof OfflineUnavailableError
            ? "Sin señal: las compras por recibir todavía no se descargaron en este celular."
            : warehouseErrorMessage(ordersQuery.error, "No se pudieron cargar las compras.")}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void ordersQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No hay compras por recibir.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {orders.map((order) => {
            const queued = pendingForPurchaseOrder(outbox, order.id);
            const pending = order.lines.reduce((sum, line) => sum + (Number(line.pendingQuantity) || 0), 0);
            return (
              <li key={order.id}>
                <button
                  type="button"
                  disabled={queued}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left active:bg-muted disabled:opacity-70"
                  aria-label={`Recibir compra ${order.number}`}
                  onClick={() => setReceiving(order)}
                >
                  <span className="min-w-0">
                    <span className="block font-mono font-semibold">{order.number}</span>
                    <span className="block text-sm">{order.supplierName ?? "Proveedor"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {warehouseName(order.inventoryId)} · {PURCHASE_STATUS_LABEL[order.status]} · {formatDay(order.purchaseDate ?? order.createdAt)}
                    </span>
                    {queued ? (
                      <span className="block text-xs font-medium text-amber-800 dark:text-amber-200">Recepción guardada: se envía al volver la señal.</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">{pending === 1 ? "1 pendiente" : `${pending} pendientes`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {receiving ? (
        <ReceivePurchaseOrderDialog
          order={receiving}
          companyId={companyId}
          warehouseName={warehouseName(receiving.inventoryId)}
          fill="zero"
          onClose={() => setReceiving(null)}
          onReceived={() => {
            setReceiving(null);
            refresh();
          }}
          onConflict={refresh}
          submit={async (body) =>
            toWriteResult<ReceivePurchaseOrderResult>(
              await enqueue(WAREHOUSE_ACTION.purchaseReceive, { orderId: receiving.id, orderNumber: receiving.number, body }),
              "la recepción",
            )
          }
          renderScanner={(scan) => <ScanInput id="almacen-compra-scan" label="Escanear (suma 1 a lo recibido)" onCode={scan} />}
          localLookup={(code) => matchCodeLocally(code, variants)}
          onFeedback={(kind) => scanFeedback(kind)}
        />
      ) : null}
    </div>
  );
}
