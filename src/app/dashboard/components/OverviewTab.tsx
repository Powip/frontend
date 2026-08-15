"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  AlertTriangle,
  ChevronRight,
  Headphones,
  Package,
  Phone,
  Settings2,
  Truck,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useCcKpisFunnel } from "@/hooks/useCcKpisFunnel";
import { useCcAging } from "@/hooks/useCcAging";
import { useCcUpsell } from "@/hooks/useCcUpsell";
import { useAgentePerformance } from "@/hooks/useAgentePerformance";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useDashboardByChannel } from "@/hooks/useDashboardByChannel";
import { useDashboardByLocation } from "@/hooks/useDashboardByLocation";
import { useDashboardByPayment } from "@/hooks/useDashboardByPayment";
import { useDashboardReceivables } from "@/hooks/useDashboardReceivables";
import { useDashboardShippingGuides } from "@/hooks/useDashboardShippingGuides";
import { useDashboardCouriersList } from "@/hooks/useDashboardCouriersList";
import { useDashboardInventory } from "@/hooks/useDashboardInventory";
import {
  AvatarCircle,
  KpiCard,
  KpiGrid,
  MockBadge,
  ProgressRow,
  roundPct,
  SectionCard,
  SkeletonRows,
  StatMini,
} from "./shared";
import { mockAlert, mockModulos } from "./mock-data";

const MODULE_ICONS = { Package, Settings2, Truck, Headphones, Phone, Users } as const;

const AGENT_COLORS = ["bg-violet-600", "bg-blue-500", "bg-pink-500", "bg-amber-500", "bg-emerald-500"];

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

const GUIDE_TERMINAL_STATUSES = new Set(["ENTREGADA", "FALLIDA", "PARCIAL"]);

const CHANNEL_META: Record<string, { label: string; color: string; pillClass: string }> = {
  WHATSAPP: { label: "WA", color: "bg-emerald-500", pillClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  INSTAGRAM: { label: "IG", color: "bg-pink-500", pillClass: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400" },
  FACEBOOK: { label: "FB", color: "bg-blue-500", pillClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  WEB: { label: "Web", color: "bg-indigo-500", pillClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" },
  TIENDA_FISICA: { label: "Tda", color: "bg-slate-500", pillClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  MERCADOLIBRE: { label: "ML", color: "bg-amber-500", pillClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  MARKETPLACE: { label: "Mkt", color: "bg-amber-500", pillClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  OTRO: { label: "Otro", color: "bg-slate-400", pillClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

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

// Apagado a propósito: banner de alerta y módulos operativos siguen con datos
// de ejemplo (ver comentarios más abajo) y no deben verse en producción.
// Poner en true recién cuando ambas secciones estén conectadas a datos reales.
const SHOW_UNCONNECTED_SECTIONS = false;

const MODULE_DESTINATIONS: Record<string, string> = {
  inventario: "general",
  operaciones: "operaciones",
  courier: "courier",
  callcenter: "equipo",
  courier2: "courier",
  clientes: "geo",
};

interface OverviewTabProps {
  fromDate: string;
  toDate: string;
  onGoToTab?: (tab: string) => void;
}

export function OverviewTab({ fromDate, toDate, onGoToTab }: OverviewTabProps) {
  const router = useRouter();
  const { selectedStoreId, auth, inventories } = useAuth();
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const sellerId = isAdmin ? undefined : auth?.user?.id;
  const companyId = auth?.company?.id;
  const inventoryId = inventories?.find((inv) => inv.storeId === selectedStoreId)?.id;

  const range: DateRange | undefined = useMemo(() => {
    if (!fromDate || !toDate) return undefined;
    return { from: new Date(`${fromDate}T00:00:00`), to: new Date(`${toDate}T23:59:59`) };
  }, [fromDate, toDate]);

  // Todas las queries se disparan en paralelo (cada useQuery es independiente),
  // y cada sección muestra su propio skeleton mientras resuelve — así ninguna
  // llamada lenta bloquea al resto de la pantalla.
  const funnelQuery = useCcKpisFunnel(selectedStoreId, range);
  const agingQuery = useCcAging(selectedStoreId, range);
  const upsellQuery = useCcUpsell(selectedStoreId, range);
  const summaryQuery = useDashboardSummary(selectedStoreId, fromDate, toDate, sellerId);
  const channelQuery = useDashboardByChannel(selectedStoreId, fromDate, toDate, sellerId);
  const locationQuery = useDashboardByLocation(selectedStoreId, fromDate, toDate, sellerId);
  const paymentQuery = useDashboardByPayment(selectedStoreId, fromDate, toDate, sellerId);
  const agentesQuery = useAgentePerformance(selectedStoreId, companyId, range ?? { from: undefined, to: undefined });
  const receivablesQuery = useDashboardReceivables(selectedStoreId, fromDate, toDate, sellerId);
  const guidesQuery = useDashboardShippingGuides(selectedStoreId);
  const couriersListQuery = useDashboardCouriersList(companyId);
  const inventoryQuery = useDashboardInventory(inventoryId);

  const summary = summaryQuery.data;
  const funnel = funnelQuery.data;
  const upsell = upsellQuery.data;
  const agentes = useMemo(() => agentesQuery.data ?? [], [agentesQuery.data]);

  const kpis = [
    {
      label: "Ventas Totales",
      value: summary ? `S/ ${summary.totalSales.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : summaryQuery.isError ? "Error" : "—",
      sub: summaryQuery.isError ? "No se pudo cargar" : "Período seleccionado",
      primary: true,
      loading: summaryQuery.isPending,
    },
    {
      label: "Órdenes",
      value: summary ? summary.totalOrders : summaryQuery.isError ? "Error" : "—",
      sub: summaryQuery.isError ? "No se pudo cargar" : "Total ingresadas",
      loading: summaryQuery.isPending,
    },
    {
      label: "Ticket Promedio",
      value: summary ? `S/ ${summary.averageTicket.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : summaryQuery.isError ? "Error" : "—",
      sub: "Por orden",
      loading: summaryQuery.isPending,
    },
    {
      label: "Efectividad COD",
      value: funnel ? `${roundPct(funnel.conversionFinal.percentage)}%` : funnelQuery.isError ? "Error" : "—",
      sub: funnel
        ? `${funnel.entregados.count} de ${funnel.ingresados.count}`
        : funnelQuery.isError
          ? "No se pudo cargar"
          : "Entregados / Ingresados",
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      loading: funnelQuery.isPending,
    },
    {
      label: "Upsell Generado",
      value: upsell ? `S/ ${upsell.consolidado.upsellMonto.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : upsellQuery.isError ? "Error" : "—",
      sub: upsellQuery.isError ? "No se pudo cargar" : "Ingreso adicional",
      valueClassName: "text-violet-600 dark:text-violet-400",
      trend: upsell ? { label: `${roundPct(upsell.consolidado.pctConUpsell)}% tasa`, direction: "up" as const } : undefined,
      loading: upsellQuery.isPending,
    },
  ];

  const pipeline = funnel
    ? [
        { key: "ingresados", label: "Ingresados", value: funnel.ingresados.count, pct: 100 },
        { key: "confirmados", label: "Confirmados", value: funnel.confirmados.count, pct: roundPct(funnel.confirmados.percentage) },
        { key: "despachados", label: "Despachados", value: funnel.despachados.count, pct: roundPct(funnel.despachados.percentage) },
        { key: "entregados", label: "Entregados", value: funnel.entregados.count, pct: roundPct(funnel.entregados.percentage) },
      ]
    : [];

  const distribucion = funnel?.distribucion;
  const leaks = distribucion
    ? [
        { label: "No Contesta", value: distribucion.noContesta.count, color: "bg-amber-500" },
        { label: "Anulados", value: distribucion.anulado.count, color: "bg-red-500" },
        { label: "Pendientes", value: distribucion.pendiente.count, color: "bg-violet-500" },
      ]
    : [];

  const efectividadOperativa = funnel
    ? roundPct(
        funnel.subBreakdown
          ? funnel.subBreakdown.entregado.percentage
          : funnel.confirmados.count > 0
            ? (funnel.entregados.count / funnel.confirmados.count) * 100
            : 0,
      )
    : 0;

  const efectividad = funnel
    ? [
        { label: "Efectividad Real", sub: "Entregados / Ingresados", value: `${roundPct(funnel.conversionFinal.percentage)}%`, className: "text-emerald-600 dark:text-emerald-400" },
        { label: "Efectividad Operativa", sub: "Entregados / Confirmados", value: `${efectividadOperativa}%`, className: "text-blue-600 dark:text-blue-400" },
      ]
    : [];

  const topChannels = useMemo(() => {
    const channels = channelQuery.data?.salesChannels ?? [];
    const sorted = [...channels].sort((a, b) => b.ordersCount - a.ordersCount).slice(0, 4);
    const max = Math.max(...sorted.map((c) => c.ordersCount), 1);
    return sorted.map((c) => ({ ...c, meta: CHANNEL_META[c.channel] ?? CHANNEL_META.OTRO, barPct: (c.ordersCount / max) * 100 }));
  }, [channelQuery.data]);

  const agingBuckets = useMemo(() => {
    const estados = agingQuery.data?.estados ?? [];
    const sums = estados.reduce(
      (acc, row) => {
        acc.d0 += row.dias.d0;
        acc.d1 += row.dias.d1;
        acc.d2 += row.dias.d2;
        acc.d3 += row.dias.d3;
        acc.d4 += row.dias.d4;
        acc.d5 += row.dias.d5;
        acc.d6plus += row.dias.d6plus;
        return acc;
      },
      { d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6plus: 0 },
    );
    return [
      { label: "<24h", value: sums.d0, className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
      { label: "1-2d", value: sums.d1 + sums.d2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
      { label: "3-4d", value: sums.d3 + sums.d4, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
      { label: "+5d", value: sums.d5 + sums.d6plus, className: "bg-red-600 text-white" },
    ];
  }, [agingQuery.data]);

  const today = format(new Date(), "yyyy-MM-dd");
  const ventasDiarias = useMemo(() => {
    return (summary?.dailySales ?? []).map((d) => {
      const dateObj = new Date(`${d.date}T12:00:00`);
      return {
        day: format(dateObj, "dd"),
        label: `${format(dateObj, "dd-MMM", { locale: es })} · S/${d.amount.toLocaleString("es-PE")}`,
        amount: d.amount,
        isToday: d.date === today,
      };
    });
  }, [summary, today]);
  const maxVenta = Math.max(...ventasDiarias.map((d) => d.amount), 1);

  const geoTop = (locationQuery.data ?? []).slice(0, 5);
  const pagos = (paymentQuery.data ?? []).slice(0, 4);

  const upsellTopAgentes = useMemo(() => {
    const withUpsell = [...agentes].sort((a, b) => b.upsellMonto - a.upsellMonto).slice(0, 3);
    const max = Math.max(...withUpsell.map((a) => a.upsellMonto), 1);
    return withUpsell.map((a, i) => ({
      initials: getInitials(a.nombre),
      color: AGENT_COLORS[i % AGENT_COLORS.length],
      name: a.nombre ?? "Sin nombre",
      value: `S/${Math.round(a.upsellMonto).toLocaleString("es-PE")}`,
      pct: (a.upsellMonto / max) * 100,
    }));
  }, [agentes]);

  const equipoLeaderboard = useMemo(() => {
    const ranked = [...agentes].sort((a, b) => b.ventasConfirmadas - a.ventasConfirmadas).slice(0, 3);
    return ranked.map((a, i) => ({
      rank: i + 1,
      name: a.nombre ?? "Sin nombre",
      initials: getInitials(a.nombre),
      color: AGENT_COLORS[i % AGENT_COLORS.length],
      meta: `${roundPct(a.pctConfirmados)}% conf · ${roundPct(a.pctContactados)}% contactados`,
      value: `S/${Math.round(a.ventasConfirmadas).toLocaleString("es-PE")}`,
    }));
  }, [agentes]);

  const vendedorEstrella = equipoLeaderboard[0];

  const equipoFooter = useMemo(() => {
    const totalAsignados = agentes.reduce((s, a) => s + a.asignados, 0);
    const totalContactados = agentes.reduce((s, a) => s + a.contactados, 0);
    const totalConfirmados = agentes.reduce((s, a) => s + a.confirmados, 0);
    const contactRate = totalAsignados > 0 ? Math.round((totalContactados / totalAsignados) * 100) : 0;
    const confirmRate = totalAsignados > 0 ? Math.round((totalConfirmados / totalAsignados) * 100) : 0;
    return [
      { label: "Contact rate", value: `${contactRate}%`, className: "text-foreground" },
      { label: "Confirmación", value: `${confirmRate}%`, className: "text-blue-600 dark:text-blue-400" },
      {
        label: "Tasa NCI",
        value: distribucion ? `${roundPct(distribucion.noContesta.percentage)}%` : "—",
        className: "text-amber-600 dark:text-amber-400",
      },
    ];
  }, [agentes, distribucion]);

  const inventoryItems = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data]);
  const criticalItems = useMemo(
    () => [...inventoryItems].filter((i) => i.availableStock < 3).sort((a, b) => a.availableStock - b.availableStock),
    [inventoryItems],
  );
  const inventoryResumen = useMemo(() => {
    const total = inventoryItems.length;
    const withStock = inventoryItems.filter((i) => i.availableStock > 0).length;
    const outOfStock = inventoryItems.filter((i) => i.availableStock <= 0).length;
    const avgStock = total > 0 ? inventoryItems.reduce((s, i) => s + (i.availableStock || 0), 0) / total : 0;
    return {
      totalSkus: total,
      // Rotación/cobertura: misma heurística aproximada que ya usa metricas/inventario (no es un cálculo exacto).
      rotacion: total > 0 ? Number(((withStock / total) * 6).toFixed(1)) : 0,
      cobertura: total > 0 ? Math.round(avgStock * 3) : 0,
      criticos: criticalItems.length,
      stockOutPct: total > 0 ? Number(((outOfStock / total) * 100).toFixed(1)) : 0,
    };
  }, [inventoryItems, criticalItems]);

  const guides = useMemo(() => guidesQuery.data ?? [], [guidesQuery.data]);
  const couriersList = useMemo(() => couriersListQuery.data ?? [], [couriersListQuery.data]);
  const courierRows = useMemo(() => {
    const byName = new Map<string, { envios: number; delivered: number }>();
    couriersList.forEach((c) => byName.set(c.name, { envios: 0, delivered: 0 }));
    guides.forEach((g) => {
      const name = g.courierName ?? "Sin asignar";
      if (name === "Sin asignar") return;
      const entry = byName.get(name) ?? { envios: 0, delivered: 0 };
      entry.envios += 1;
      if (g.status === "ENTREGADA") entry.delivered += 1;
      byName.set(name, entry);
    });
    return [...byName.entries()]
      .map(([name, s], i) => ({
        name,
        initials: getInitials(name),
        color: AGENT_COLORS[i % AGENT_COLORS.length],
        meta: `${s.envios} órdenes`,
        eff: s.envios > 0 ? `${Math.round((s.delivered / s.envios) * 100)}%` : "—",
        envios: s.envios,
      }))
      .sort((a, b) => b.envios - a.envios)
      .slice(0, 3);
  }, [couriersList, guides]);
  const couriersActivos = courierRows.filter((c) => c.envios > 0).length;
  const enTransito = guides.filter((g) => !GUIDE_TERMINAL_STATUSES.has(g.status)).length;
  const receivables = receivablesQuery.data;

  const handleModuleClick = (key: string) => {
    if (key === "atencion") {
      router.push("/atencion-cliente");
      return;
    }
    onGoToTab?.(MODULE_DESTINATIONS[key] ?? "general");
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      {/*
        MOCK: banner de alerta de riesgo (mockAlert en mock-data.ts).
        No se conectó porque getPedidosCC (atencionClienteService.ts) no tiene
        confirmado cómo startDate/endDate filtran "más viejo que N horas" en el
        backend — mostrar un riesgo mal calculado es peor que no mostrarlo.
        Para conectarlo: confirmar semántica de esos params con backend y usar
        getPedidosCC({ subEstado: "por_confirmar", endDate, page:1, limit:1 }).total
        (barato: solo lee el total, no trae los pedidos).
        Oculto en producción hasta que se conecte — ver SHOW_UNCONNECTED_SECTIONS.
      */}
      {SHOW_UNCONNECTED_SECTIONS && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-red-800 dark:text-red-300">{mockAlert.title}</span>
            <span className="text-red-700/80 dark:text-red-400/80 ml-2">· {mockAlert.subtitle}</span>
            <MockBadge className="ml-2" />
          </div>
          <Button
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white h-7 text-[11px] shrink-0"
            onClick={() => onGoToTab?.("cod")}
          >
            Ver Gestión COD <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* KPIs */}
      <KpiGrid cols={5}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      {/* Pipeline COD + Canal de origen */}
      <div className="grid grid-cols-[3fr_2fr] gap-3.5">
        <SectionCard title="Pipeline COD" subtitle="Flujo completo de pedidos · período seleccionado">
          {funnelQuery.isPending ? (
            <SkeletonRows rows={4} />
          ) : funnelQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">
              No se pudo cargar el pipeline COD. {funnelQuery.error instanceof Error ? funnelQuery.error.message : ""}
            </p>
          ) : (
            <>
              <div className="flex items-stretch gap-0">
                {pipeline.map((stage, idx) => (
                  <div key={stage.key} className="flex-1 flex items-center">
                    <div
                      className={cn(
                        "flex-1 rounded-lg px-2 py-2.5 text-center mx-1",
                        idx === 0 && "bg-slate-100 dark:bg-slate-800/60",
                        idx === 1 && "bg-blue-50 dark:bg-blue-500/10",
                        idx === 2 && "bg-violet-50 dark:bg-violet-500/10",
                        idx === 3 && "bg-emerald-50 dark:bg-emerald-500/10"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xl font-extrabold leading-none",
                          idx === 0 && "text-slate-600 dark:text-slate-300",
                          idx === 1 && "text-blue-700 dark:text-blue-400",
                          idx === 2 && "text-violet-700 dark:text-violet-400",
                          idx === 3 && "text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        {stage.value}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                        {stage.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{stage.pct}%</div>
                    </div>
                    {idx < pipeline.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 -mx-0.5" />
                    )}
                  </div>
                ))}
              </div>

              {leaks.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {leaks.map((leak) => (
                    <div key={leak.label} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", leak.color)} />
                      <div>
                        <div className="text-sm font-bold text-foreground leading-none">{leak.value}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{leak.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                {efectividad.map((eff) => (
                  <div key={eff.label} className="text-center">
                    <div className={cn("text-2xl font-extrabold", eff.className)}>{eff.value}</div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">
                      {eff.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70">{eff.sub}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Canal de Origen" subtitle="Pedidos por canal en el período">
          {channelQuery.isPending ? (
            <SkeletonRows rows={4} />
          ) : channelQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar el canal de origen.</p>
          ) : topChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin datos para el período seleccionado.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topChannels.map((canal) => (
                <div key={canal.channel} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold w-9",
                      canal.meta.pillClass
                    )}
                  >
                    {canal.meta.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", canal.meta.color)} style={{ width: `${canal.barPct}%` }} />
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-foreground">{canal.ordersCount}</div>
                      <div className="text-[9px] text-muted-foreground">ped.</div>
                    </div>
                    <div className="text-right w-10">
                      <div className="text-xs font-bold text-muted-foreground">{roundPct(canal.percentage)}%</div>
                      <div className="text-[9px] text-muted-foreground">del total</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3.5 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-foreground mb-2">🛡️ Aging pendientes</p>
            {agingQuery.isPending ? (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : agingQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400 py-2 text-center">No se pudo cargar el aging.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {agingBuckets.map((cell) => (
                  <div key={cell.label} className={cn("rounded-lg px-1 py-1.5 text-center", cell.className)}>
                    <div className="text-sm font-extrabold leading-none">{cell.value}</div>
                    <div className="text-[9px] font-semibold mt-0.5">{cell.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Ventas diarias + Upsell + Equipo */}
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3.5">
        <SectionCard
          title="Ventas Diarias"
          subtitle="Ventas en el período"
          right={
            <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Ventas
              </span>
            </div>
          }
        >
          {summaryQuery.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : summaryQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-10 text-center">No se pudo cargar las ventas diarias.</p>
          ) : ventasDiarias.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">Sin ventas registradas en el período.</p>
          ) : (
            <>
              <div className="flex items-end gap-1 h-32">
                {ventasDiarias.map((d, i) => (
                  <div key={`${d.day}-${i}`} className="group relative flex-1 h-full flex items-end">
                    <div
                      className={cn(
                        "w-full rounded-t transition-opacity group-hover:opacity-80",
                        d.isToday ? "bg-violet-600" : d.amount === 0 ? "bg-violet-100 dark:bg-violet-500/10" : "bg-violet-200 dark:bg-violet-500/25"
                      )}
                      style={{ height: `${Math.max((d.amount / maxVenta) * 100, 3)}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {d.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {ventasDiarias.map((d, i) => (
                  <span
                    key={`${d.day}-lbl-${i}`}
                    className={cn(
                      "flex-1 text-center text-[9px]",
                      d.isToday ? "text-violet-600 dark:text-violet-400 font-bold" : "text-muted-foreground"
                    )}
                  >
                    {d.day}
                  </span>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Upsell" subtitle="Ventas adicionales en el período">
          {upsellQuery.isPending ? (
            <SkeletonRows rows={3} />
          ) : upsellQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar el upsell.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400 tracking-tight">
                  {upsell ? `S/ ${upsell.consolidado.upsellMonto.toLocaleString("es-PE")}` : "—"}
                </span>
                {upsell && (
                  <span className="rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 text-xs font-bold px-2 py-1">
                    {roundPct(upsell.consolidado.pctSobreBase)}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-sm font-extrabold text-foreground">{upsell ? `${roundPct(upsell.consolidado.pctConUpsell)}%` : "—"}</div>
                  <div className="text-[10px] text-muted-foreground">Tasa upsell</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-sm font-extrabold text-foreground">
                    {upsell ? `S/ ${Math.round(upsell.consolidado.ticketConUpsell)}` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Ticket con upsell</div>
                </div>
              </div>
            </>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2">TOP AGENTES</p>
            {!companyId ? (
              <p className="text-xs text-muted-foreground py-2 text-center">No se pudo determinar la empresa.</p>
            ) : agentesQuery.isPending ? (
              <SkeletonRows rows={3} />
            ) : agentesQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400 py-2 text-center">No se pudo cargar el ranking de agentes.</p>
            ) : upsellTopAgentes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Sin datos para el período.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upsellTopAgentes.map((agent) => (
                  <div key={agent.initials + agent.name} className="flex items-center gap-2">
                    <AvatarCircle initials={agent.initials} color={agent.color} size="sm" />
                    <span className="flex-1 text-xs font-medium text-foreground truncate">{agent.name}</span>
                    <div className="w-14 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${agent.pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 w-12 text-right">
                      {agent.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Equipo" subtitle="Rendimiento en el período">
          {!companyId ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No se pudo determinar la empresa.</p>
          ) : agentesQuery.isPending ? (
            <SkeletonRows rows={5} />
          ) : agentesQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar el equipo.</p>
          ) : (
            <>
              {vendedorEstrella && (
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground mb-1">VENDEDOR ESTRELLA ⭐</p>
                  <p className="text-sm font-bold text-foreground">{vendedorEstrella.name}</p>
                  <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{vendedorEstrella.value}</p>
                  <p className="text-[10px] text-muted-foreground">{vendedorEstrella.meta}</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {equipoLeaderboard.map((row) => (
                  <div key={row.name} className="flex items-center gap-2 py-1 border-b border-border/60 last:border-0">
                    <span className="w-4 text-center text-sm">{row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : "🥉"}</span>
                    <AvatarCircle initials={row.initials} color={row.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{row.name}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{row.meta}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-border">
            {equipoFooter.map((s) => (
              <StatMini key={s.label} label={s.label} value={s.value} className={s.className} />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Inventario crítico + Couriers + Geografía */}
      <div className="grid grid-cols-3 gap-3.5">
        <SectionCard
          title="Inventario Crítico"
          subtitle="Productos con stock <3 unidades"
          right={
            <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 text-[10px] font-bold px-2 py-1">
              {!inventoryId || inventoryQuery.isPending ? "…" : `${inventoryResumen.stockOutPct}% stock-out`}
            </span>
          }
        >
          {!inventoryId ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Esta tienda no tiene un inventario asociado.
            </p>
          ) : inventoryQuery.isPending ? (
            <SkeletonRows rows={5} />
          ) : inventoryQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar el inventario.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <StatMini label="Total SKUs" value={inventoryResumen.totalSkus} />
                <StatMini label="Rotación" value={`${inventoryResumen.rotacion}x`} className="text-emerald-600 dark:text-emerald-400" />
                <StatMini label="Cobertura" value={`${inventoryResumen.cobertura}d`} className="text-amber-600 dark:text-amber-400" />
                <StatMini label="Críticos" value={inventoryResumen.criticos} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="flex flex-col">
                {criticalItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Sin productos críticos en este inventario.</p>
                ) : (
                  criticalItems.slice(0, 4).map((item) => (
                    <div key={item.inventoryItemId} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
                      <span className="text-xs text-muted-foreground truncate">{item.productName}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 min-w-[16px] text-right shrink-0">
                        {item.availableStock}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {criticalItems.length > 4 && (
                <div className="text-center mt-2">
                  <span
                    className="text-xs font-semibold text-violet-600 dark:text-violet-400 cursor-pointer"
                    onClick={() => router.push("/metricas/inventario")}
                  >
                    Ver los {criticalItems.length} críticos →
                  </span>
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard title="Couriers" subtitle="Rendimiento de entrega">
          {guidesQuery.isPending || couriersListQuery.isPending ? (
            <SkeletonRows rows={5} />
          ) : guidesQuery.isError || couriersListQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar couriers.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <StatMini label="Activos" value={couriersActivos} />
                <StatMini label="En tránsito" value={enTransito} />
              </div>
              <div className="flex flex-col">
                {courierRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Sin envíos en el período.</p>
                ) : (
                  courierRows.map((c) => (
                    <div key={c.name} className="flex items-center gap-2.5 py-1.5 border-b border-border/60 last:border-0">
                      <AvatarCircle initials={c.initials} color={c.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{c.meta}</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-bold shrink-0",
                          c.eff === "—" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {c.eff}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-1">CUENTAS POR COBRAR (saldo pendiente)</p>
            {receivablesQuery.isPending ? (
              <Skeleton className="h-6 w-24" />
            ) : receivablesQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400">No se pudo cargar.</p>
            ) : (
              <>
                <p className="text-lg font-extrabold text-foreground">
                  {receivables ? `S/ ${receivables.pendingTotal.toLocaleString("es-PE")}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {receivables ? `${receivables.pendingOrders.length} pedidos entregados sin pago confirmado` : "Sin datos"}
                </p>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Geografía Top" subtitle="Distribución territorial">
          {locationQuery.isPending ? (
            <SkeletonRows rows={5} />
          ) : locationQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar la geografía.</p>
          ) : geoTop.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin datos para el período seleccionado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {geoTop.map((geo) => (
                <ProgressRow
                  key={geo.name}
                  label={geo.name}
                  pct={geo.percentage}
                  color="bg-violet-500"
                  right={<span className="text-xs font-semibold text-muted-foreground w-10 text-right">{roundPct(geo.percentage)}%</span>}
                />
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground mb-2">MÉTODO DE PAGO</p>
            {paymentQuery.isPending ? (
              <SkeletonRows rows={3} />
            ) : paymentQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400 py-2 text-center">No se pudo cargar.</p>
            ) : pagos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Sin datos.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {pagos.map((p) => {
                  const meta = PAYMENT_META[p.method] ?? PAYMENT_META.OTRO;
                  return (
                    <div key={p.method} className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", meta.color)} />
                      <span className="flex-1 text-xs text-foreground">{p.method.replace(/_/g, " ")}</span>
                      <span className={cn("text-xs font-bold", meta.textColor)}>{roundPct(p.percentage)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/*
        MOCK: 7 tarjetas de módulos operativos (mockModulos en mock-data.ts).
        Cruza 5-6 microservicios (inventario, operaciones, courier, CC, clientes) —
        la mayoría de los tiles se podrían armar con endpoints ya usados en esta
        misma tab (inventoryQuery, guides, funnel), pero dos quedan bloqueados:
        "clientes nuevos del mes" (Client no trae createdAt) y "tickets de
        atención al cliente abiertos" (no hay endpoint de tickets, solo pedidos CC).
        Oculto en producción hasta que se conecte — ver SHOW_UNCONNECTED_SECTIONS.
      */}
      {SHOW_UNCONNECTED_SECTIONS && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5 flex items-center gap-2">
            📌 Estado de módulos operativos
            <MockBadge />
          </p>
          <div className="grid grid-cols-7 gap-2.5">
            {mockModulos.map((mod) => {
              const Icon = MODULE_ICONS[mod.icon as keyof typeof MODULE_ICONS];
              return (
                <Card
                  key={mod.key}
                  className="cursor-pointer border-2 border-red-500 bg-red-50 dark:bg-red-950/30 hover:shadow-md transition-all py-3.5 gap-0"
                  onClick={() => handleModuleClick(mod.key)}
                >
                  <CardContent className="px-3.5">
                    <Icon className="h-5 w-5 text-violet-500 mb-1.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {mod.label}
                    </p>
                    <p className={cn("text-xl font-extrabold leading-none", mod.valueClass)}>{mod.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{mod.sub}</p>
                    <span className={cn("inline-block text-[10px] font-semibold rounded-full px-1.5 py-0.5 mt-1.5", mod.statusClass)}>
                      {mod.status}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
