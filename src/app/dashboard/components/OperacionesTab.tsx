"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import { SectionCard, SkeletonRows } from "./shared";

const ACCENT_BORDER: Record<string, string> = {
  amber: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/5",
  emerald: "border-l-emerald-500",
  red: "border-l-red-500",
};

const ACCENT_TEXT: Record<string, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
};

// Estados reales de OrderHeader.status agrupados en las 6 filas del mockup.
const ESTADO_GROUPS: { label: string; statuses: string[]; color: string; className: string; bold?: boolean }[] = [
  { label: "Pendiente", statuses: ["PENDIENTE"], color: "bg-slate-400", className: "text-slate-500" },
  { label: "Preparado", statuses: ["PREPARADO", "LLAMADO"], color: "bg-amber-500", className: "text-amber-700 dark:text-amber-400" },
  { label: "Con guía", statuses: ["ASIGNADO_A_GUIA"], color: "bg-violet-500", className: "text-violet-700 dark:text-violet-400" },
  { label: "En envío", statuses: ["EN_ENVIO"], color: "bg-orange-500", className: "text-orange-700 dark:text-orange-400" },
  { label: "Entregado ✓", statuses: ["ENTREGADO", "PAGADO"], color: "bg-emerald-500", className: "text-emerald-700 dark:text-emerald-400", bold: true },
  { label: "Rechazado/Dev.", statuses: ["ANULADO"], color: "bg-red-500", className: "text-red-700 dark:text-red-400" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

interface OperacionesTabProps {
  fromDate: string;
  toDate: string;
}

export function OperacionesTab({ fromDate, toDate }: OperacionesTabProps) {
  const { selectedStoreId } = useAuth();
  const ordersQuery = useDashboardOrders(selectedStoreId);

  const ordersInPeriod = useMemo(() => {
    const all = ordersQuery.data ?? [];
    // Igual que Pedidos: INCOMPLETE (checkout sin terminar) y PREVENTA no son
    // pedidos operativos reales todavía.
    const visible = all.filter((o) => o.status !== "INCOMPLETE" && (o.status as string) !== "PREVENTA");
    if (!fromDate || !toDate) return visible;
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59`);
    return visible.filter((o) => {
      const d = new Date(o.created_at);
      return d >= from && d <= to;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  const estadoPedidos = useMemo(() => {
    const total = ordersInPeriod.length || 1;
    return ESTADO_GROUPS.map((g) => {
      const value = ordersInPeriod.filter((o) => g.statuses.includes(o.status)).length;
      return { ...g, value, pct: Math.round((value / total) * 100) };
    });
  }, [ordersInPeriod]);

  const estadoTotal = ordersInPeriod.length;

  const sinCourierAsignado = useMemo(
    () => ordersInPeriod.filter((o) => !o.guideNumber && (o.status === "PREPARADO" || o.status === "LLAMADO")).length,
    [ordersInPeriod],
  );

  const retrasados = useMemo(() => {
    const now = Date.now();
    return ordersInPeriod.filter((o) => {
      if (o.status !== "EN_ENVIO" && o.status !== "ASIGNADO_A_GUIA") return false;
      const days = (now - new Date(o.created_at).getTime()) / DAY_MS;
      return days > 20;
    }).length;
  }, [ordersInPeriod]);

  const tasaIncidencia = useMemo(() => {
    if (ordersInPeriod.length === 0) return null;
    const conIncidencia = ordersInPeriod.filter((o) => o.hasStockIssue).length;
    return { pct: Math.round((conIncidencia / ordersInPeriod.length) * 100), count: conIncidencia };
  }, [ordersInPeriod]);

  const kpis = [
    {
      label: "Sin Courier Asignado",
      value: ordersQuery.isPending ? "…" : ordersQuery.isError ? "Error" : sinCourierAsignado,
      note: "Preparado/Llamado sin guía",
      accent: "amber",
    },
    {
      label: "Retrasados en Envío +20d",
      value: ordersQuery.isPending ? "…" : ordersQuery.isError ? "Error" : retrasados,
      note: "En envío/con guía, sin confirmar entrega",
      accent: "red",
    },
    {
      label: "Tasa Incidencia",
      value: ordersQuery.isPending ? "…" : ordersQuery.isError ? "Error" : tasaIncidencia ? `${tasaIncidencia.pct}%` : "—",
      note: tasaIncidencia ? `${tasaIncidencia.count} pedidos con problema de stock` : "Pedidos con problema de stock",
      accent: tasaIncidencia && tasaIncidencia.pct > 5 ? "red" : "emerald",
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-3 gap-3.5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={cn("rounded-xl border border-border border-l-4 bg-card p-4", ACCENT_BORDER[kpi.accent])}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={cn("text-3xl font-extrabold tracking-tight", ACCENT_TEXT[kpi.accent])}>{kpi.value}</p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1.5">{kpi.note}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Estado actual de todos los pedidos"
        right={
          <span className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 text-[10px] font-bold px-2 py-1">
            {estadoTotal} total
          </span>
        }
      >
        {ordersQuery.isPending ? (
          <SkeletonRows rows={6} />
        ) : ordersQuery.isError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudieron cargar los pedidos.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {estadoPedidos.map((e) => (
                <div key={e.label} className="flex items-center gap-2.5">
                  <div className={cn("min-w-[90px] text-xs", e.bold ? "font-bold" : "text-muted-foreground", e.bold && e.className)}>
                    {e.label}
                  </div>
                  <div className="flex-1 h-3.5 rounded bg-muted overflow-hidden">
                    <div className={cn("h-full rounded", e.color)} style={{ width: `${e.pct}%` }} />
                  </div>
                  <div className={cn("min-w-[70px] text-right text-xs font-bold", e.className)}>
                    {e.value} · {e.pct}%
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2 mt-3.5">
              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">Total verificado</span>
              <span className="text-xs font-extrabold text-violet-700 dark:text-violet-400">
                {estadoPedidos.map((e) => e.value).join("+")} = {estadoTotal} ✓
              </span>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
