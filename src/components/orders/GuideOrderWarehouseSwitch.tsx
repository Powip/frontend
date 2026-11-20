"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiErrorStatus, warehouseChangeBlockReason, type WarehouseChangeOrder } from "@/lib/orderStock";
import { changeReservationWarehouse } from "@/services/orderStockService";
import { listWarehouses } from "@/services/warehousesService";

// FEAT-24 H12-D3 — en «Nueva guía» (guía del courier): cambiar el almacén del
// que sale el pedido sin salir del armado de la guía. Mismo endpoint que el
// detalle del pedido (PATCH /order-header/:id/stock-warehouse): solo antes del
// despacho; si el pedido ya avanzó, ms-ventas responde 409 y se muestra su motivo.

export interface GuideOrderWarehouseSwitchOrder extends WarehouseChangeOrder {
  id: string;
  orderNumber: string;
  inventoryId?: string | null;
}

interface Props {
  companyId: string;
  order: GuideOrderWarehouseSwitchOrder;
  onChanged: (inventoryId: string) => void;
}

export function GuideOrderWarehouseSwitch({ companyId, order, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(order.inventoryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const blocked = warehouseChangeBlockReason(order);

  const warehousesQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: Boolean(companyId) && !blocked,
    retry: false,
    staleTime: 60_000,
  });

  const change = useMutation({
    mutationFn: (inventoryId: string) => changeReservationWarehouse(order.id, inventoryId),
    onSuccess: (_, inventoryId) => {
      setError(null);
      setEditing(false);
      const name = warehousesQuery.data?.warehouses.find((w) => w.id === inventoryId)?.name;
      toast.success(name ? `${order.orderNumber} sale del almacén ${name}` : `${order.orderNumber}: almacén cambiado`);
      onChanged(inventoryId);
    },
    onError: (failure) =>
      setError(
        apiErrorStatus(failure) === 409
          ? apiErrorMessage(failure, "Ya no se puede cambiar el almacén: el pedido avanzó o ya salió del almacén.")
          : apiErrorMessage(failure, "No se pudo cambiar el almacén."),
      ),
  });

  if (blocked) return null;

  const warehouses = warehousesQuery.data?.warehouses ?? [];
  const current = warehouses.find((w) => w.id === order.inventoryId);
  const active = warehouses.filter((w) => w.status || w.id === order.inventoryId);

  return (
    <div className="mt-1 text-left" data-testid={`guide-warehouse-${order.id}`}>
      {!editing ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Warehouse className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{warehousesQuery.isPending ? "Almacén…" : (current?.name ?? (order.inventoryId ? "Almacén desconocido" : "Sin almacén"))}</span>
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
            disabled={warehousesQuery.isPending || warehousesQuery.isError}
            onClick={() => {
              setTarget(order.inventoryId ?? "");
              setError(null);
              setEditing(true);
            }}
            aria-label={`Cambiar el almacén de ${order.orderNumber}`}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label={`Almacén de ${order.orderNumber}`}
            className="h-8 min-w-[10rem] rounded-md border border-input bg-background px-2 text-xs"
            value={target}
            disabled={change.isPending}
            onChange={(event) => setTarget(event.target.value)}
          >
            {!order.inventoryId ? <option value="">Sin almacén asignado</option> : null}
            {order.inventoryId && !current ? <option value={order.inventoryId}>Almacén desconocido</option> : null}
            {active.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.status ? "" : " (inactivo)"}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={change.isPending || !target || target === (order.inventoryId ?? "")}
            onClick={() => change.mutate(target)}
          >
            {change.isPending ? "Cambiando…" : "Guardar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={change.isPending} onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {warehousesQuery.isError ? <p className="text-[11px] text-muted-foreground">No se pudieron cargar los almacenes.</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
