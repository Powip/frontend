"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PickingPanel from "@/components/picking/PickingPanel";
import { StockStateBadge } from "@/components/orders/StockStateBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsPedidos } from "@/hooks/useOperationsPedidos";
import { orderStockAccess } from "@/lib/orderStock";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import type { OrderStatus } from "@/interfaces/IOrder";
import { OPERATIONS_PAGE_SIZE } from "@/services/operationsPedidosService";

// FEAT-24 H2-F — Operaciones › Picking: pedidos a despachar (En camino y
// Preparados) y, al elegir uno, sus líneas para tomarlas con el lector.

type PickingTab = "en-camino" | "preparados";

export default function PickingScreen() {
  const { hasPermission } = useAuth();
  const access = orderStockAccess((permission) => hasPermission?.(permission) ?? false);
  const [tab, setTab] = useState<PickingTab>("en-camino");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; orderNumber: string } | null>(null);

  const orders = useOperationsPedidos(
    { tab, page, limit: OPERATIONS_PAGE_SIZE, filters: { search } },
    { enabled: access.operations },
  );

  if (!access.operations) {
    return (
      <div className="rounded-xl border p-10 text-center">
        <h1 className="text-xl font-semibold">No tienes acceso al picking</h1>
        <p className="mt-2 text-muted-foreground">Necesitas el permiso de gestionar Operaciones o de actualizar entregas.</p>
      </div>
    );
  }

  const counts = orders.data?.counts;
  const rows = orders.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <ScanLine className="h-6 w-6" aria-hidden="true" />
          Picking
        </h1>
        <p className="text-sm text-muted-foreground">
          Elige un pedido y escanea sus productos con el lector. Al completar, un pedido En envío pasa a Despachado.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-3" aria-label="Pedidos a despachar">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as PickingTab);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="en-camino" className="gap-2">
                En camino
                {counts ? <Badge variant="secondary">{counts.enCamino}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="preparados" className="gap-2">
                Preparados
                {counts ? <Badge variant="secondary">{counts.preparados}</Badge> : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            aria-label="Buscar pedido"
            placeholder="Buscar por pedido o cliente"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          {orders.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando pedidos…</p>
          ) : orders.isError ? (
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
              {rows.map((order) => {
                const active = selected?.id === order.id;
                return (
                  <li key={order.id} className={active ? "bg-muted/60" : undefined}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                      aria-label={`Abrir picking de ${order.orderNumber}`}
                      aria-pressed={active}
                      onClick={() => setSelected({ id: order.id, orderNumber: order.orderNumber })}
                    >
                      <span>
                        <span className="block font-mono font-semibold">{order.orderNumber}</span>
                        <span className="block text-xs text-muted-foreground">{order.customer?.fullName || "—"}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1 text-xs">
                        <span>{getStatusLabel(order.status as OrderStatus)}</span>
                        <StockStateBadge state={order.stockState} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {orders.data && orders.data.totalPages > 1 ? (
            <Pagination
              currentPage={page}
              totalPages={orders.data.totalPages}
              totalItems={orders.data.total}
              itemsPerPage={OPERATIONS_PAGE_SIZE}
              onPageChange={setPage}
              itemName="pedidos"
            />
          ) : null}
        </section>

        <section aria-label="Picking del pedido" className="rounded-md border p-4">
          {selected ? (
            <PickingPanel
              key={selected.id}
              orderId={selected.id}
              orderNumber={selected.orderNumber}
              onDispatched={() => setSelected(null)}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Elige un pedido de la lista para empezar.</p>
          )}
        </section>
      </div>
    </div>
  );
}
