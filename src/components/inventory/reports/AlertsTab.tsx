"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { resolveOrderNumbers } from "@/services/orderNumbersService";
import { alertCounts, alertOrderIds, alertRows, upcomingAlerts, type AlertTone } from "@/lib/reports/alerts";
import { formatPeruDateTime } from "@/components/inventory/movementLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// FEAT-24 H10-D8 — Inventario › Alertas (mockup vAlertas): una fila por alerta
// con su color, su tipo, el detalle y el botón que lleva a la pantalla que la
// resuelve. Las alertas de hitos que todavía no existen se listan apagadas.

const BAR: Record<AlertTone, string> = { red: "bg-red-500", amber: "bg-amber-500", slate: "bg-slate-400" };
const BADGE: Record<AlertTone, string> = {
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
};

export default function AlertsTab() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const alerts = useInventoryAlerts();
  const { nameOf } = useCompanyWarehouses();
  const orderIds = useMemo(() => (alerts.data ? alertOrderIds(alerts.data) : []), [alerts.data]);
  const orderNumbers = useQuery({
    queryKey: ["inventory-alert-order-numbers", companyId, orderIds],
    queryFn: () => resolveOrderNumbers(orderIds),
    enabled: orderIds.length > 0,
    staleTime: 5 * 60_000,
  });
  const rows = useMemo(
    () => (alerts.data ? alertRows(alerts.data, { orderNumbers: orderNumbers.data ?? {}, warehouseName: nameOf }) : []),
    [alerts.data, orderNumbers.data, nameOf],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Alertas</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">Lo que necesita atención en tu inventario. Cada alerta trae el botón para resolverla.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void alerts.refetch()} disabled={alerts.isFetching}>
          {alerts.isFetching ? "Actualizando…" : "Actualizar"}
        </Button>
      </div>

      {alerts.error ? (
        <div role="alert" className="rounded border border-destructive p-4 text-sm">
          No se pudieron cargar las alertas. {alerts.error instanceof Error ? alerts.error.message : ""}{" "}
          <Button variant="outline" size="sm" onClick={() => void alerts.refetch()}>Reintentar</Button>
        </div>
      ) : null}

      {alerts.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2" aria-label="Resumen de alertas">
            <Badge variant="secondary">{alerts.data.total} {alerts.data.total === 1 ? "alerta" : "alertas"}</Badge>
            {alertCounts(alerts.data).map((item) => (
              <Badge key={item.type} variant="outline" className={BADGE[item.tone]}>{item.title}: {item.count}</Badge>
            ))}
            <span className="text-xs text-muted-foreground">Actualizado el {formatPeruDateTime(alerts.data.generatedAt)}</span>
          </div>

          <div className="overflow-hidden rounded-md border bg-card">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No hay alertas. Todo en orden.</p>
            ) : (
              <ul>
                {rows.map((row) => (
                  <li key={row.key} className="flex items-stretch border-b last:border-b-0">
                    <span aria-hidden className={cn("w-1.5 shrink-0", BAR[row.tone])} />
                    <div className="flex flex-1 flex-wrap items-center gap-3 px-4 py-3">
                      <Badge variant="outline" className={cn("w-[170px] justify-center", BADGE[row.tone])}>{row.title}</Badge>
                      <span className="min-w-[200px] flex-1 text-sm">{row.description}</span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={row.href}>{row.action}</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {upcomingAlerts(alerts.data).length ? (
            <p className="text-xs text-muted-foreground">Llegan con próximas versiones: {upcomingAlerts(alerts.data).join(", ")}.</p>
          ) : null}
        </>
      ) : alerts.isFetching ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando alertas…</p>
      ) : null}
    </div>
  );
}
