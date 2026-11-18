"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import CourierStockTable from "@/components/inventory/couriers/CourierStockTable";
import ReconciliationPanel from "@/components/inventory/couriers/ReconciliationPanel";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { useAuth } from "@/contexts/AuthContext";
import { courierAccess, lastReadingText, syncText } from "@/lib/courier";
import { opsErrorMessage } from "@/lib/warehouseOps";
import { getCourierStock, listCourierWarehouses, listReconciliations } from "@/services/sharedCourierService";

// FEAT-24 H8-D5 — portal del courier en el modo almacén: el stock de SU almacén
// (POWIP contra lo que reportó) y la conciliación, solo para mirar y sin montos
// ni reclamos (la fachada los omite y responde 403 a lo demás). Contar y recibir
// traslados usan las pantallas de siempre del modo almacén.

export type CourierPortalView = "stock" | "conciliacion";

export default function CourierPortalScreen({ view }: { view: CourierPortalView }) {
  const { auth } = useAuth();
  const access = courierAccess(auth?.user);
  const [selectedId, setSelectedId] = useState("");
  const warehousesQuery = useQuery({
    queryKey: ["portal-courier-warehouses", auth?.company?.id, auth?.user?.id],
    queryFn: ({ signal }) => listCourierWarehouses(signal),
    enabled: access.view,
    retry: false,
  });
  const warehouses = warehousesQuery.data ?? [];
  const current = warehouses.find((warehouse) => warehouse.id === selectedId) ?? warehouses[0] ?? null;
  const currentId = current?.id ?? "";

  const stockQuery = useQuery({
    queryKey: ["portal-courier-stock", currentId],
    queryFn: ({ signal }) => getCourierStock(currentId, signal),
    enabled: view === "stock" && !!currentId,
    retry: false,
  });
  const reconciliationsQuery = useQuery({
    queryKey: ["portal-courier-reconciliations", currentId],
    queryFn: ({ signal }) => listReconciliations({ inventoryId: currentId }, signal),
    enabled: view === "conciliacion" && !!currentId,
    retry: false,
  });
  // La abierta; si no hay, la última (vienen de la más nueva a la más vieja).
  const reconciliations = reconciliationsQuery.data ?? [];
  const shown = reconciliations.find((rec) => rec.status === "abierta") ?? reconciliations.find((rec) => rec.status !== "anulada") ?? null;

  const title = view === "stock" ? "Stock de tu almacén" : "Conciliación";

  if (!access.view)
    return (
      <p role="alert" className="rounded-md border p-4 text-sm">
        Tu rol no ve los almacenes de courier.
      </p>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {current ? <p className="text-sm text-muted-foreground">{syncText(current)}</p> : null}
      </div>

      {warehousesQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando tu almacén…</p> : null}
      {warehousesQuery.isError ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {opsErrorMessage(warehousesQuery.error, "No se pudo cargar tu almacén.")}
        </p>
      ) : null}
      {warehousesQuery.isSuccess && warehouses.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No tienes un almacén de courier asignado.</p>
      ) : null}

      {warehouses.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tus almacenes">
          {warehouses.map((warehouse) => (
            <button
              key={warehouse.id}
              type="button"
              aria-pressed={warehouse.id === currentId}
              onClick={() => setSelectedId(warehouse.id)}
              className={`rounded-full border px-3 py-1 text-sm ${warehouse.id === currentId ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {warehouse.name}
            </button>
          ))}
        </div>
      ) : current ? (
        <p className="text-sm font-medium">{current.name}</p>
      ) : null}

      {view === "stock" && current ? (
        <>
          {stockQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando stock…</p> : null}
          {stockQuery.isError ? (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {opsErrorMessage(stockQuery.error, "No se pudo cargar el stock.")}
            </p>
          ) : null}
          {stockQuery.data ? (
            <>
              <p className="text-xs text-muted-foreground">Último dato del courier: {lastReadingText(stockQuery.data)}</p>
              <CourierStockTable stock={stockQuery.data} portal />
            </>
          ) : null}
        </>
      ) : null}

      {view === "conciliacion" && current ? (
        <>
          {reconciliationsQuery.isPending ? <p className="text-sm text-muted-foreground">Cargando conciliación…</p> : null}
          {reconciliationsQuery.isError ? (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {opsErrorMessage(reconciliationsQuery.error, "No se pudo cargar la conciliación.")}
            </p>
          ) : null}
          {reconciliationsQuery.isSuccess && !shown ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Todavía no hay conciliaciones de tu almacén.</p>
          ) : null}
          {shown ? (
            <>
              {shown.status !== "abierta" ? (
                <p className="text-xs text-muted-foreground">No hay una conciliación abierta. La última es del {formatPeruDateTime(shown.createdAt)}.</p>
              ) : null}
              <ReconciliationPanel key={shown.id} reconciliationId={shown.id} mode="portal" warehouseName={current.name} />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
