"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderHeader } from "@/interfaces/IOrder";
import { listOrderExchanges, type OrderExchange } from "@/services/orderExchangeService";
import { canExchangeOrder, exchangeableLines } from "@/lib/orderExchange";
import { soles } from "@/lib/packs/packMath";
import { ExchangeProductDialog } from "./ExchangeProductDialog";

// Carga diferida: el detalle del pedido de cambio es el mismo modal que contiene esta sección.
const NestedOrderModal = lazy(() => import("@/components/modals/CustomerServiceModal"));

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

/** FEAT-24 H12 — historial de cambios del pedido (como original o como pedido de cambio). */
export function ExchangeHistory({ orderId, exchanges, onOpenOrder }: { orderId: string; exchanges: OrderExchange[]; onOpenOrder: (id: string) => void }) {
  if (!exchanges.length) return null;
  return (
    <ul className="space-y-2" aria-label="Cambios de producto">
      {exchanges.map((exchange) => {
        const isChild = exchange.childOrderId === orderId;
        const difference = Number(exchange.priceDifference ?? 0);
        return (
          <li key={exchange.exchangeId} className="rounded-md border bg-muted/40 p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {exchange.status === "aplicado" ? "Cambio registrado" : "Cambio pendiente con inventario"}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{fmtDate(exchange.appliedAt ?? exchange.createdAt)}</span>
              </span>
              {isChild ? (
                exchange.orderId ? <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenOrder(exchange.orderId)}>Ver pedido original</Button> : null
              ) : exchange.childOrderId ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenOrder(exchange.childOrderId as string)}>
                  Ver pedido de cambio{exchange.childOrderNumber ? ` ${exchange.childOrderNumber}` : ""}
                </Button>
              ) : null}
            </div>
            <ul className="mt-1 text-xs">
              {exchange.lines.map((line) => (
                <li key={`${line.itemId}-${line.newVariantId}`}>
                  {line.quantity} × {line.productName ?? line.sku ?? "Producto"} → {line.newProductName ?? line.newSku ?? "Producto nuevo"}
                </li>
              ))}
            </ul>
            {difference > 0 ? <p className="text-xs text-muted-foreground">Diferencia a cobrar: {soles(difference)}</p> : null}
            {exchange.reason ? <p className="text-xs text-muted-foreground">Motivo: {exchange.reason}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * FEAT-24 H12 (H12-D2) — bloque «Cambio de producto» del detalle del pedido: el botón (solo despachado o
 * entregado y con permiso de Atención al cliente), el diálogo y el historial (`GET :id/exchanges`).
 */
export function OrderExchangeSection({
  order,
  canManage,
  onChanged,
}: {
  order: Pick<OrderHeader, "id" | "orderNumber" | "status" | "items"> & { externalSource?: string | null };
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nestedOrderId, setNestedOrderId] = useState<string | null>(null);
  // El detalle se recarga recién cuando se cierra lo abierto: recargarlo desmonta esta sección.
  const refreshPending = useRef(false);
  const flushRefresh = () => {
    if (!refreshPending.current) return;
    refreshPending.current = false;
    onChanged?.();
  };
  // Sin react-query a propósito: el detalle del pedido también se monta fuera de un QueryClientProvider.
  const [history, setHistory] = useState<{ orderId: string; items: OrderExchange[]; error: string }>({ orderId: "", items: [], error: "" });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    listOrderExchanges(order.id, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setHistory({ orderId: order.id, items, error: "" }); })
      .catch(() => {
        if (!controller.signal.aborted) setHistory({ orderId: order.id, items: [], error: "Intenta de nuevo más tarde." });
      });
    return () => controller.abort();
  }, [order.id, canManage, reload]);
  const lines = exchangeableLines(order.items);
  const allowed = canManage && canExchangeOrder(order);
  const current = canManage && history.orderId === order.id ? history : { items: [] as OrderExchange[], error: "" };
  const exchanges = current.items;
  if (!allowed && exchanges.length === 0) return null;

  return (
    <section className="space-y-2 rounded-lg border border-border p-4" aria-labelledby={`exchange-${order.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`exchange-${order.id}`} className="flex items-center gap-1.5 text-lg font-semibold">
          <Repeat className="h-4 w-4" aria-hidden="true" /> Cambio de producto
        </h3>
        {allowed ? (
          <Button size="sm" variant="outline" disabled={lines.length === 0} onClick={() => setDialogOpen(true)}>
            <ArrowRightLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Cambiar producto
          </Button>
        ) : null}
      </div>
      {allowed && lines.length === 0 ? <p className="text-xs text-muted-foreground">No quedan productos que se puedan cambiar (los packs y los productos con IMEI o serie no se cambian por aquí).</p> : null}
      {current.error ? <p className="text-xs text-muted-foreground">No se pudo cargar el historial de cambios. {current.error}</p> : null}
      <ExchangeHistory orderId={order.id} exchanges={exchanges} onOpenOrder={setNestedOrderId} />
      {dialogOpen ? (
        <ExchangeProductDialog
          orderId={order.id}
          orderNumber={order.orderNumber}
          lines={lines}
          onClose={() => { setDialogOpen(false); flushRefresh(); }}
          onDone={() => {
            refreshPending.current = true;
            setReload((value) => value + 1);
          }}
          onOpenOrder={(id) => { setDialogOpen(false); setNestedOrderId(id); }}
        />
      ) : null}
      {nestedOrderId ? (
        <Suspense fallback={null}>
          <NestedOrderModal open orderId={nestedOrderId} onClose={() => { setNestedOrderId(null); flushRefresh(); }} hideCallManagement />
        </Suspense>
      ) : null}
    </section>
  );
}
