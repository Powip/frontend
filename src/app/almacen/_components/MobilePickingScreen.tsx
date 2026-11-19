"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CloudOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ScanInput from "@/components/almacen/ScanInput";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import { StockStateBadge } from "@/components/orders/StockStateBadge";
import PickingPanel, { type PickingActions } from "@/components/picking/PickingPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { OPERATIONS_PEDIDOS_QUERY_KEY, useOperationsPedidos } from "@/hooks/useOperationsPedidos";
import type { OrderStatus } from "@/interfaces/IOrder";
import { scanFeedback } from "@/lib/barcodeScanner";
import { toWriteResult } from "@/lib/offlineQueue";
import { readWithSnapshot } from "@/lib/offlineStore";
import {
  formatSavedAt,
  pendingForOrder,
  snapshotKey,
  toPickingListRows,
  WAREHOUSE_ACTION,
  warehouseAccess,
  type PickingListRow,
} from "@/lib/warehouseMode";
import { getPicking, type PickingCompletion, type PickingView } from "@/services/orderStockService";
import { OPERATIONS_PAGE_SIZE } from "@/services/operationsPedidosService";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";

// FEAT-24 H6-D (H6-D3) — Picking en el celular: la lista de pedidos a
// despachar (la misma de Operaciones › Picking) y el picking línea por línea
// con el mismo PickingPanel de H2-F, en tarjetas. Cada escaneo, confirmación y
// el completar van por la cola sin conexión. Sin señal se ve la última lista y
// el último picking descargados.

type PickingTab = "en-camino" | "preparados";

function OrderPicking({ order, onBack }: { order: { id: string; orderNumber: string }; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { enqueue, snapshots, session, outbox, syncedVersion } = useWarehouseQueue();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const waiting = pendingForOrder(outbox, order.id);

  // Lo que se envió desde la cola (al volver la señal) cambia el picking: se vuelve a leer.
  useEffect(() => {
    if (syncedVersion > 0) void queryClient.invalidateQueries({ queryKey: ["order-picking", order.id] });
  }, [syncedVersion, order.id, queryClient]);

  const loadView = useCallback(async (): Promise<PickingView> => {
    if (!snapshots || !session) return getPicking(order.id);
    const read = await readWithSnapshot(snapshots, snapshotKey(session, "picking", order.id), () => getPicking(order.id), {
      online: navigator.onLine !== false,
    });
    setSavedAt(read.fromCache ? read.savedAt : null);
    return read.data;
  }, [snapshots, session, order.id]);

  const actions = useMemo<PickingActions>(
    () => ({
      scan: async (code) =>
        toWriteResult<PickingView>(
          await enqueue(WAREHOUSE_ACTION.pickingScan, { orderId: order.id, orderNumber: order.orderNumber, code }),
          `el escaneo ${code}`,
        ),
      confirmLine: async (line) =>
        toWriteResult<PickingView>(
          await enqueue(WAREHOUSE_ACTION.pickingConfirmLine, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            itemId: line.itemId,
            lineName: line.productName || line.sku || undefined,
          }),
          "la confirmación",
        ),
      complete: async () =>
        toWriteResult<PickingCompletion>(
          await enqueue(WAREHOUSE_ACTION.pickingComplete, { orderId: order.id, orderNumber: order.orderNumber }),
          "el completar",
        ),
    }),
    [enqueue, order.id, order.orderNumber],
  );

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Pedidos
      </Button>
      {savedAt !== null ? (
        <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <CloudOff className="h-3 w-3" aria-hidden="true" />
          Sin señal: picking descargado {formatSavedAt(savedAt)}
        </p>
      ) : null}
      {waiting > 0 ? (
        <p role="status" className="text-xs text-amber-800 dark:text-amber-200">
          {waiting === 1 ? "1 acción guardada" : `${waiting} acciones guardadas`} de este pedido sin enviar: se envían al volver la señal.
        </p>
      ) : null}
      {snapshots && session ? (
        <PickingPanel
          orderId={order.id}
          orderNumber={order.orderNumber}
          onDispatched={onBack}
          actions={actions}
          loadView={loadView}
          layout="cards"
          renderScanner={(scan) => <ScanInput id={`almacen-picking-${order.id}`} onCode={scan} />}
          onFeedback={(kind) => scanFeedback(kind)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Preparando el celular…</p>
      )}
    </div>
  );
}

export default function MobilePickingScreen() {
  const queryClient = useQueryClient();
  const { auth, hasPermission } = useAuth();
  const { online, snapshots, session, syncedVersion } = useWarehouseQueue();
  const access = warehouseAccess(auth?.user, (permission) => hasPermission?.(permission) ?? false);
  const [tab, setTab] = useState<PickingTab>("en-camino");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; orderNumber: string } | null>(null);
  const [cached, setCached] = useState<{ rows: PickingListRow[]; savedAt: number } | null>(null);

  const orders = useOperationsPedidos(
    { tab, page, limit: OPERATIONS_PAGE_SIZE, filters: { search } },
    { enabled: access.picking && online },
  );
  const listKey = session ? snapshotKey(session, "picking-list", tab) : null;

  // La primera página sin búsqueda queda guardada para verla sin señal.
  useEffect(() => {
    if (!orders.data || !snapshots || !listKey || search || page !== 1) return;
    void snapshots.put({ key: listKey, data: toPickingListRows(orders.data.data), savedAt: Date.now() }).catch(() => undefined);
  }, [orders.data, snapshots, listKey, search, page]);

  useEffect(() => {
    if (online || !snapshots || !listKey) {
      setCached(null);
      return;
    }
    let cancelled = false;
    void snapshots
      .get(listKey)
      .then((snapshot) => {
        if (!cancelled) setCached(snapshot ? { rows: snapshot.data as PickingListRow[], savedAt: snapshot.savedAt } : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [online, snapshots, listKey]);

  useEffect(() => {
    if (syncedVersion > 0) void queryClient.invalidateQueries({ queryKey: [OPERATIONS_PEDIDOS_QUERY_KEY] });
  }, [syncedVersion, queryClient]);

  if (!access.picking) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <h1 className="text-lg font-semibold">No tienes acceso al picking</h1>
        <p className="mt-2 text-sm text-muted-foreground">Necesitas el permiso de gestionar Operaciones o de actualizar entregas.</p>
      </div>
    );
  }

  if (selected) return <OrderPicking key={selected.id} order={selected} onBack={() => setSelected(null)} />;

  const rows: PickingListRow[] = online ? toPickingListRows(orders.data?.data ?? []) : cached?.rows ?? [];
  const counts = online ? orders.data?.counts : undefined;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-tight">Picking</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as PickingTab);
          setPage(1);
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="en-camino" className="flex-1 gap-2">
            En camino
            {counts ? <Badge variant="secondary">{counts.enCamino}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="preparados" className="flex-1 gap-2">
            Preparados
            {counts ? <Badge variant="secondary">{counts.preparados}</Badge> : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {online ? (
        <Input
          aria-label="Buscar pedido"
          placeholder="Buscar por pedido o cliente"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      ) : (
        <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <CloudOff className="h-3 w-3" aria-hidden="true" />
          {cached ? `Sin señal: lista descargada ${formatSavedAt(cached.savedAt)}` : "Sin señal: esta lista no se descargó en este celular."}
        </p>
      )}

      {online && orders.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando pedidos…</p>
      ) : online && orders.isError ? (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          No se pudieron cargar los pedidos.
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void orders.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No hay pedidos para despachar.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left active:bg-muted"
                aria-label={`Abrir picking de ${order.orderNumber}`}
                onClick={() => setSelected({ id: order.id, orderNumber: order.orderNumber })}
              >
                <span className="min-w-0">
                  <span className="block font-mono font-semibold">{order.orderNumber}</span>
                  <span className="block truncate text-xs text-muted-foreground">{order.customerName || "—"}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <span>{getStatusLabel(order.status as OrderStatus)}</span>
                  <StockStateBadge state={order.stockState} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {online && orders.data && orders.data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page} de {orders.data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= orders.data.totalPages} onClick={() => setPage((current) => current + 1)}>
            Siguiente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
