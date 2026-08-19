"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useDashboardByLocation } from "@/hooks/useDashboardByLocation";
import { useDashboardByPayment } from "@/hooks/useDashboardByPayment";
import { useDashboardClients } from "@/hooks/useDashboardClients";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import { HoverTip, KpiCard, KpiGrid, ProgressRow, roundPct, SectionCard, SkeletonRows } from "./shared";

// Pedidos ya confirmados/en camino pero todavía no entregados (ni anulados) —
// mismos estados intermedios que usa Operaciones para "sin courier"/"retrasados".
const PENDING_DELIVERY_STATUSES = new Set(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO"]);

const PAYMENT_META: Record<string, { color: string; textColor: string }> = {
  YAPE: { color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
  PLIN: { color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
  CONTRAENTREGA: { color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
  BCP: { color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  BANCO_NACION: { color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  MERCADO_PAGO: { color: "bg-cyan-500", textColor: "text-cyan-600 dark:text-cyan-400" },
  POS: { color: "bg-slate-400", textColor: "text-slate-600 dark:text-slate-400" },
  OTRO: { color: "bg-slate-400", textColor: "text-slate-600 dark:text-slate-400" },
};

interface GeoTabProps {
  fromDate: string;
  toDate: string;
}

export function GeoTab({ fromDate, toDate }: GeoTabProps) {
  const { selectedStoreId, auth } = useAuth();
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const sellerId = isAdmin ? undefined : auth?.user?.id;
  const companyId = auth?.company?.id;

  const locationQuery = useDashboardByLocation(selectedStoreId, fromDate, toDate, sellerId);
  const paymentQuery = useDashboardByPayment(selectedStoreId, fromDate, toDate, sellerId);
  const clientsQuery = useDashboardClients(companyId);
  const ordersQuery = useDashboardOrders(selectedStoreId);

  const geoTop = (locationQuery.data ?? []).slice(0, 7);
  const pagos = (paymentQuery.data ?? []).slice(0, 4);

  // Pedidos ingresados en el período (por created_at, igual criterio que
  // Operaciones/Comercial) — base para pendientes de entrega por región.
  const ordersInPeriod = useMemo(() => {
    const all = ordersQuery.data ?? [];
    const visible = all.filter((o) => o.status !== "INCOMPLETE" && (o.status as string) !== "PREVENTA");
    if (!fromDate || !toDate) return visible;
    return visible.filter((o) => {
      const d = o.created_at.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  const pendientesPorRegion = useMemo(() => {
    const pending = ordersInPeriod.filter((o) => PENDING_DELIVERY_STATUSES.has(o.status));
    return {
      lima: pending.filter((o) => o.salesRegion === "LIMA").length,
      provincia: pending.filter((o) => o.salesRegion === "PROVINCIA").length,
    };
  }, [ordersInPeriod]);

  // totalPurchases/totalPurchaseAmount son opcionales en el backend — si
  // ningún cliente los trae, mostramos "sin datos" en vez de un 0% falso.
  // El backend los devuelve como string a veces (mismo patrón que grandTotal
  // en OrderHeader), pese a que el tipo declara number — por eso se
  // convierten con Number() antes de sumar (sumar strings sin convertir
  // concatena en vez de sumar y termina dando NaN al dividir).
  const clientStats = useMemo(() => {
    const clients = clientsQuery.data ?? [];
    const withPurchaseCount = clients.filter(
      (c) => c.totalPurchases !== undefined && c.totalPurchases !== null && !Number.isNaN(Number(c.totalPurchases)),
    );
    const withPurchaseAmount = clients.filter(
      (c) =>
        c.totalPurchaseAmount !== undefined && c.totalPurchaseAmount !== null && !Number.isNaN(Number(c.totalPurchaseAmount)),
    );

    const oneOrder = withPurchaseCount.filter((c) => Number(c.totalPurchases) === 1).length;
    const repeatOrders = withPurchaseCount.filter((c) => Number(c.totalPurchases) >= 2 && Number(c.totalPurchases) <= 3).length;
    const recompraCount = withPurchaseCount.filter((c) => Number(c.totalPurchases) > 1).length;
    const recompraPct = withPurchaseCount.length > 0 ? Math.round((recompraCount / withPurchaseCount.length) * 100) : null;
    const ltv =
      withPurchaseAmount.length > 0
        ? withPurchaseAmount.reduce((sum, c) => sum + Number(c.totalPurchaseAmount), 0) / withPurchaseAmount.length
        : null;

    return {
      total: clients.length,
      hasPurchaseData: withPurchaseCount.length > 0,
      oneOrder,
      repeatOrders,
      recompraPct,
      ltv,
    };
  }, [clientsQuery.data]);

  const kpis = [
    {
      label: "Zona Top",
      value: geoTop[0] ? geoTop[0].name : locationQuery.isError ? "Error" : "—",
      sub: geoTop[0] ? `${roundPct(geoTop[0].percentage)}% del total` : "Distribución territorial",
      primary: true,
      loading: locationQuery.isPending,
    },
    {
      label: "Pago Líder",
      value: pagos[0] ? pagos[0].method.replace(/_/g, " ") : paymentQuery.isError ? "Error" : "—",
      sub: pagos[0] ? `${roundPct(pagos[0].percentage)}% de acogida` : "Método de pago",
      loading: paymentQuery.isPending,
    },
    {
      label: "Total Clientes",
      value: clientsQuery.data ? clientStats.total : clientsQuery.isError ? "Error" : "—",
      sub: "Registrados en la empresa",
      loading: clientsQuery.isPending,
    },
    {
      label: "Tasa Recompra",
      value: clientStats.hasPurchaseData ? `${clientStats.recompraPct}%` : clientsQuery.isError ? "Error" : "—",
      sub: clientStats.hasPurchaseData ? "Meta: >35%" : "Sin datos de recompra",
      valueClassName:
        clientStats.hasPurchaseData && (clientStats.recompraPct ?? 0) < 35 ? "text-amber-600 dark:text-amber-400" : undefined,
      loading: clientsQuery.isPending,
    },
    {
      label: "LTV Estimado",
      value: clientStats.ltv !== null ? `S/ ${Math.round(clientStats.ltv).toLocaleString("es-PE")}` : clientsQuery.isError ? "Error" : "—",
      sub: "Valor de por vida (prom.)",
      loading: clientsQuery.isPending,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <KpiGrid cols={5}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard title="Impacto por departamento" subtitle="Facturación">
          {locationQuery.isPending ? (
            <SkeletonRows rows={7} />
          ) : locationQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar la geografía.</p>
          ) : geoTop.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin datos para el período seleccionado.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {geoTop.map((geo) => (
                <HoverTip
                  key={geo.name}
                  title={geo.name}
                  rows={[
                    { label: "Pedidos", value: geo.ordersCount },
                    { label: "Facturación", value: `S/ ${geo.totalAmount.toLocaleString("es-PE")}` },
                  ]}
                >
                  <ProgressRow
                    label={geo.name}
                    pct={geo.percentage}
                    labelWidth="min-w-[100px]"
                    color="bg-violet-500"
                    right={<span className="text-xs font-semibold text-muted-foreground w-10 text-right">{roundPct(geo.percentage)}%</span>}
                  />
                </HoverTip>
              ))}
            </div>
          )}

          <div className="mt-3.5 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2">PENDIENTES DE ENTREGA</p>
            {ordersQuery.isPending ? (
              <SkeletonRows rows={2} />
            ) : ordersQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400 py-2 text-center">No se pudo cargar los pendientes.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg p-2.5 text-center bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <div className="text-lg font-extrabold">{pendientesPorRegion.lima}</div>
                  <div className="text-[10px]">Lima/Callao pend.</div>
                </div>
                <div className="rounded-lg p-2.5 text-center bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <div className="text-lg font-extrabold">{pendientesPorRegion.provincia}</div>
                  <div className="text-[10px]">Provincia pend.</div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Preferencia de pago">
          {paymentQuery.isPending ? (
            <SkeletonRows rows={4} />
          ) : paymentQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar los métodos de pago.</p>
          ) : pagos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin datos para el período seleccionado.</p>
          ) : (
            <div className="flex flex-col">
              {pagos.map((p) => {
                const meta = PAYMENT_META[p.method] ?? PAYMENT_META.OTRO;
                return (
                  <HoverTip
                    key={p.method}
                    title={p.method.replace(/_/g, " ")}
                    rows={[
                      { label: "Pedidos", value: p.ordersCount },
                      { label: "Facturación", value: `S/ ${p.totalAmount.toLocaleString("es-PE")}` },
                    ]}
                  >
                    <div className="flex items-center gap-2.5 py-2 border-b border-border/60 cursor-default">
                      <span className={cn("h-3 w-3 rounded-full shrink-0", meta.color)} />
                      <span className="flex-1 text-sm font-medium text-foreground">{p.method.replace(/_/g, " ")}</span>
                      <span className={cn("text-sm font-extrabold", meta.textColor)}>{roundPct(p.percentage)}%</span>
                    </div>
                  </HoverTip>
                );
              })}
            </div>
          )}

          <div className="mt-3.5 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2">RETENCIÓN DE CLIENTES</p>
            {clientsQuery.isPending ? (
              <SkeletonRows rows={3} />
            ) : clientsQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400 py-2 text-center">No se pudo cargar los clientes.</p>
            ) : !clientStats.hasPurchaseData ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                Los clientes de esta empresa no tienen historial de compras registrado.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg p-2.5 text-center bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <div className="text-lg font-extrabold">{clientStats.oneOrder}</div>
                    <div className="text-[10px]">1 compra</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <div className="text-lg font-extrabold">{clientStats.repeatOrders}</div>
                    <div className="text-[10px]">2–3 compras</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <div className="text-lg font-extrabold">{clientStats.recompraPct}%</div>
                    <div className="text-[10px]">recompra</div>
                  </div>
                </div>
                {(clientStats.recompraPct ?? 0) < 35 && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2.5 py-2 text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Recompra por debajo de la meta (35%). Oportunidad: secuencia post-entrega.
                  </div>
                )}
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
