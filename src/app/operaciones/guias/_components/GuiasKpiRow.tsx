"use client";

import { OperationsDataError } from "@/app/operaciones/_shared/OperationsDataError";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessGuides } from "@/hooks/useBusinessGuides";

import { useEffect, useMemo, useState } from "react";
import axios from "@/lib/axiosAuth";
import { ClipboardList, Clock3, CheckCircle2, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OrderHeader } from "@/interfaces/IOrder";
import type { ShippingGuide } from "@/components/modals/GuideDetailsModal";

/* -----------------------------------------------------------------------
   Fila de 4 KPIs sobre las 5 pestañas de Guías & Courier — el mockup los
   tenía justo debajo del header de la pantalla. Se fue en el primer corte
   (no estaba en el brief del agente); se agrega acá como componente propio
   para no reabrir page.tsx/GuiasActivasTab más de lo necesario.
------------------------------------------------------------------------ */

const CLOSED_STATUSES = new Set(["ENTREGADA", "CANCELADA"]);

function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isThisMonth(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function GuiasKpiRow() {
  const orderQuery = useBusinessOrders();
  const guideQuery = useBusinessGuides<ShippingGuide>();
  const { orders } = orderQuery;
  const { guides } = guideQuery;
  const loading = orderQuery.loading || guideQuery.loading;
  const error = orderQuery.error || guideQuery.error;
  const retry = () => Promise.all([orderQuery.retry(), guideQuery.retry()]);

  const kpis = useMemo(() => {
    const activas = guides.filter((g) => !CLOSED_STATUSES.has(g.status)).length;
    const sinAprobar = guides.filter((g) => g.status === "CREADA").length;
    const cerradasEsteMes = guides.filter((g) => g.status === "ENTREGADA" && isThisMonth(g.updated_at)).length;
    const costoEnvioMes = orders
      .filter((o) => isThisMonth(o.updated_at) && o.carrierShippingCost)
      .reduce((sum, o) => sum + Number(o.carrierShippingCost || 0), 0);
    return { activas, sinAprobar, cerradasEsteMes, costoEnvioMes, totalGuias: guides.length };
  }, [guides, orders]);

  if (error) return <OperationsDataError retry={retry} message="No se pudieron cargar las estadísticas de guías." />;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi icon={<ClipboardList className="h-4 w-4" />} color="teal" label="Guías activas" value={kpis.activas} sub={`${kpis.totalGuias} en total`} />
      <Kpi icon={<Clock3 className="h-4 w-4" />} color="amber" label="Sin aprobar" value={kpis.sinAprobar} sub="Creadas, aún no salieron" />
      <Kpi icon={<CheckCircle2 className="h-4 w-4" />} color="green" label="Cerradas este mes" value={kpis.cerradasEsteMes} sub="Entregadas" />
      <Kpi icon={<Wallet className="h-4 w-4" />} color="purple" label="Costo de envío" value={money(kpis.costoEnvioMes)} sub="Mes en curso" />
    </div>
  );
}

const COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
  green: "border-l-green-500 text-green-600 dark:text-green-400",
  purple: "border-l-violet-500 text-violet-600 dark:text-violet-400",
};

function Kpi({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className={`rounded-xl border border-l-4 bg-card p-4 shadow-sm ${COLOR[color]}`}>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
