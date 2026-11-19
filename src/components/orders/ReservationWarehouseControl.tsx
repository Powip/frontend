"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StockStateBadge } from "@/components/orders/StockStateBadge";
import { apiErrorMessage, warehouseChangeBlockReason } from "@/lib/orderStock";
import { changeReservationWarehouse } from "@/services/orderStockService";
import { listWarehouses } from "@/services/warehousesService";

// FEAT-24 H2-F — en el detalle del pedido: cambiar el almacén de la reserva
// (solo antes del despacho y con permiso de gestionar Operaciones). Logística
// mueve la reserva al almacén nuevo o deja el pedido sin stock.

interface Props {
  companyId: string;
  order: {
    id: string;
    status?: string | null;
    stockState?: string | null;
    externalSource?: string | null;
    inventoryId?: string | null;
  };
  onChanged: () => void;
}

export function ReservationWarehouseControl({ companyId, order, onChanged }: Props) {
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
      const name = warehousesQuery.data?.warehouses.find((w) => w.id === inventoryId)?.name;
      toast.success(name ? `La reserva pasa al almacén ${name}` : "Almacén de la reserva cambiado");
      onChanged();
    },
    onError: (failure) => setError(apiErrorMessage(failure, "No se pudo cambiar el almacén.")),
  });

  if (blocked) return null;

  const warehouses = warehousesQuery.data?.warehouses ?? [];
  const active = warehouses.filter((w) => w.status || w.id === order.inventoryId);
  const current = warehouses.find((w) => w.id === order.inventoryId);

  return (
    <div className="space-y-2 rounded-lg border border-border p-4" data-testid="reservation-warehouse">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Warehouse className="h-4 w-4" aria-hidden="true" />
          Almacén de la reserva
        </h3>
        <StockStateBadge state={order.stockState} />
      </div>
      {warehousesQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando almacenes…</p>
      ) : warehousesQuery.isError ? (
        <p className="text-sm text-muted-foreground">No se pudieron cargar los almacenes.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Almacén de la reserva"
            className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
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
            size="sm"
            variant="outline"
            disabled={change.isPending || !target || target === (order.inventoryId ?? "")}
            onClick={() => change.mutate(target)}
          >
            {change.isPending ? "Cambiando…" : "Cambiar almacén"}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Solo antes del despacho. Si el almacén nuevo no tiene stock, el pedido queda sin stock.
      </p>
    </div>
  );
}
