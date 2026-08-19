"use client";

import { useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCcKpisFunnel } from "@/hooks/useCcKpisFunnel";
import { useAgentePerformance } from "@/hooks/useAgentePerformance";
import { useDashboardSellers } from "@/hooks/useDashboardSellers";
import { useDashboardDeliveryBySeller } from "@/hooks/useDashboardDeliveryBySeller";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import {
  AGENT_COLORS,
  AvatarCircle,
  ChannelPill,
  CHANNEL_SHORT,
  getInitials,
  KpiCard,
  KpiGrid,
  roundPct,
  SectionCard,
  SkeletonRows,
} from "./shared";

type SortKey = "facturacion" | "volumen" | "efectividad";
const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: "facturacion", label: "Por facturación" },
  { key: "volumen", label: "Por volumen" },
  { key: "efectividad", label: "Por efectividad" },
];

interface EquipoTabProps {
  fromDate: string;
  toDate: string;
}

export function EquipoTab({ fromDate, toDate }: EquipoTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("facturacion");
  const { selectedStoreId, auth } = useAuth();
  const companyId = auth?.company?.id;

  const range: DateRange | undefined = useMemo(() => {
    if (!fromDate || !toDate) return undefined;
    return { from: new Date(`${fromDate}T00:00:00`), to: new Date(`${toDate}T23:59:59`) };
  }, [fromDate, toDate]);

  const funnelQuery = useCcKpisFunnel(selectedStoreId, range);
  const agentesQuery = useAgentePerformance(selectedStoreId, companyId, range ?? { from: undefined, to: undefined });
  const sellersQuery = useDashboardSellers(companyId, fromDate, toDate);
  const deliveryQuery = useDashboardDeliveryBySeller(selectedStoreId, fromDate, toDate);
  const ordersQuery = useDashboardOrders(selectedStoreId);

  const funnel = funnelQuery.data;
  const distribucion = funnel?.distribucion;
  const agentes = useMemo(() => agentesQuery.data ?? [], [agentesQuery.data]);

  // Pedidos ingresados en el período (por created_at, igual criterio que
  // Comercial/Operaciones) — base para cruzar canal por vendedor/agente.
  const ordersInPeriod = useMemo(() => {
    const all = ordersQuery.data ?? [];
    const visible = all.filter((o) => o.status !== "INCOMPLETE" && (o.status as string) !== "PREVENTA");
    if (!fromDate || !toDate) return visible;
    return visible.filter((o) => {
      const d = o.created_at.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  // Canal principal por vendedor: OrderHeader no tiene sellerId, solo
  // sellerName — se cruza por nombre exacto (mejor esfuerzo disponible).
  const canalPorVendedor = useMemo(() => {
    const counts = new Map<string, Map<string, number>>();
    ordersInPeriod.forEach((o) => {
      if (!o.sellerName) return;
      const perChannel = counts.get(o.sellerName) ?? new Map<string, number>();
      const ch = o.salesChannel ?? "OTRO";
      perChannel.set(ch, (perChannel.get(ch) ?? 0) + 1);
      counts.set(o.sellerName, perChannel);
    });
    const result = new Map<string, string>();
    counts.forEach((perChannel, seller) => {
      const top = [...perChannel.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) result.set(seller, top[0]);
    });
    return result;
  }, [ordersInPeriod]);

  // No Contesta / Anulados / Canales por agente ATC, vía ccAgenteId —
  // AgentePerformanceKpis no trae este desglose, así que se calcula acá con
  // los mismos pedidos del período.
  const agenteExtras = useMemo(() => {
    const map = new Map<string, { nc: number; anulados: number; canales: Set<string> }>();
    ordersInPeriod.forEach((o) => {
      if (!o.ccAgenteId) return;
      const entry = map.get(o.ccAgenteId) ?? { nc: 0, anulados: 0, canales: new Set<string>() };
      if (o.subEstadoCc === "no_contesta") entry.nc += 1;
      if (o.subEstadoCc === "anulado_cc") entry.anulados += 1;
      entry.canales.add(o.salesChannel ?? "OTRO");
      map.set(o.ccAgenteId, entry);
    });
    return map;
  }, [ordersInPeriod]);

  const vendedores = useMemo(() => {
    const sellers = sellersQuery.data ?? [];
    const delivery = deliveryQuery.data ?? [];
    const deliveryById = new Map(delivery.map((d) => [d.sellerId, d]));

    const enriched = sellers
      .filter((s) => s.sellerId && s.sellerId !== "unassigned" && s.sellerId !== "unknown")
      .map((s, i) => {
        const del = deliveryById.get(s.sellerId);
        const created = del?.createdCount ?? s.orderCount;
        const delivered = del?.deliveredCount ?? 0;
        return {
          ...s,
          initials: getInitials(s.sellerName),
          color: AGENT_COLORS[i % AGENT_COLORS.length],
          canal: canalPorVendedor.get(s.sellerName) ?? null,
          prodOrd: s.orderCount > 0 ? s.productsCount / s.orderCount : 0,
          delivered,
          created,
          effectiveness: created > 0 ? Math.round((delivered / created) * 100) : 0,
        };
      });

    const sorted = [...enriched].sort((a, b) => {
      if (sortKey === "volumen") return b.orderCount - a.orderCount;
      if (sortKey === "efectividad") return b.effectiveness - a.effectiveness;
      return b.totalSales - a.totalSales;
    });

    return sorted;
  }, [sellersQuery.data, deliveryQuery.data, sortKey, canalPorVendedor]);

  const vendedoresTotal = useMemo(() => {
    const orderCount = vendedores.reduce((s, v) => s + v.orderCount, 0);
    const productsCount = vendedores.reduce((s, v) => s + v.productsCount, 0);
    const totalSales = vendedores.reduce((s, v) => s + v.totalSales, 0);
    const delivered = vendedores.reduce((s, v) => s + v.delivered, 0);
    const created = vendedores.reduce((s, v) => s + v.created, 0);
    return {
      orderCount,
      productsCount,
      prodOrd: orderCount > 0 ? productsCount / orderCount : 0,
      averageTicket: orderCount > 0 ? totalSales / orderCount : 0,
      totalSales,
      effectiveness: created > 0 ? Math.round((delivered / created) * 100) : 0,
    };
  }, [vendedores]);

  const agentesConDatos = useMemo(() => {
    return [...agentes]
      .sort((a, b) => b.upsellMonto - a.upsellMonto)
      .map((a, i) => {
        const extra = agenteExtras.get(a.id);
        return {
          ...a,
          initials: getInitials(a.nombre),
          color: AGENT_COLORS[i % AGENT_COLORS.length],
          upsellRate: a.facturacionBase > 0 ? Math.round((a.upsellMonto / a.facturacionBase) * 100) : 0,
          nc: extra?.nc ?? 0,
          anulados: extra?.anulados ?? 0,
          canales: extra ? [...extra.canales] : [],
        };
      });
  }, [agentes, agenteExtras]);

  const agentesTotal = useMemo(() => {
    const asignados = agentes.reduce((s, a) => s + a.asignados, 0);
    const confirmados = agentes.reduce((s, a) => s + a.confirmados, 0);
    const upsellMonto = agentes.reduce((s, a) => s + a.upsellMonto, 0);
    const facturacionBase = agentes.reduce((s, a) => s + a.facturacionBase, 0);
    const ticketSum = agentes.reduce((s, a) => s + a.ticketPromedio * a.confirmados, 0);
    const nc = agentesConDatos.reduce((s, a) => s + a.nc, 0);
    const anulados = agentesConDatos.reduce((s, a) => s + a.anulados, 0);
    return {
      asignados,
      confirmados,
      nc,
      anulados,
      conv: asignados > 0 ? Math.round((confirmados / asignados) * 100) : 0,
      upsellRate: facturacionBase > 0 ? Math.round((upsellMonto / facturacionBase) * 100) : 0,
      upsellMonto,
      ticketPromedio: confirmados > 0 ? ticketSum / confirmados : 0,
    };
  }, [agentes, agentesConDatos]);

  const topAgente = agentesConDatos[0];

  const kpis = [
    {
      label: "Top Agente",
      value: topAgente ? topAgente.nombre ?? "Sin nombre" : agentesQuery.isError ? "Error" : "—",
      sub: topAgente ? `S/ ${Math.round(topAgente.upsellMonto).toLocaleString("es-PE")} upsell` : "Por upsell generado",
      trend: topAgente ? { label: `${roundPct(topAgente.pctConfirmados)}% conf.`, direction: "up" as const } : undefined,
      primary: true,
      loading: agentesQuery.isPending,
    },
    {
      label: "Agentes ATC",
      value: agentesQuery.data ? agentes.length : agentesQuery.isError ? "Error" : "—",
      sub: `${agentesTotal.asignados} asignados en total`,
      loading: agentesQuery.isPending,
    },
    {
      label: "Tasa Confirmación CC",
      value: funnel ? `${roundPct(funnel.confirmados.percentage)}%` : funnelQuery.isError ? "Error" : "—",
      sub: funnel ? `${funnel.confirmados.count} / ${funnel.gestionados.count} gestionados` : "Confirmados / gestionados",
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      loading: funnelQuery.isPending,
    },
    {
      label: "Tasa No Contesta",
      value: distribucion ? `${roundPct(distribucion.noContesta.percentage)}%` : funnelQuery.isError ? "Error" : "—",
      sub: distribucion ? `${distribucion.noContesta.count} / ${distribucion.total} gestionados` : "Sin respuesta",
      valueClassName: "text-amber-600 dark:text-amber-400",
      loading: funnelQuery.isPending,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <SectionCard
        title="Rendimiento de vendedores — pedidos, facturación y efectividad de entrega"
        subtitle="Período seleccionado"
        right={
          <div className="flex gap-1.5">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSortKey(tab.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  tab.key === sortKey
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-card text-muted-foreground border-border hover:border-violet-300 hover:text-violet-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
        contentClassName="px-0"
      >
        {sellersQuery.isPending || deliveryQuery.isPending ? (
          <div className="px-5">
            <SkeletonRows rows={5} />
          </div>
        ) : sellersQuery.isError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-6 text-center">No se pudieron cargar los vendedores.</p>
        ) : vendedores.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sin ventas registradas en el período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-8 pl-5">#</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="text-right">Prod/Orden</TableHead>
                <TableHead className="text-right">Ticket Promedio</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
                <TableHead className="text-right pr-5">Efectividad Entrega</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedores.map((v, i) => (
                <TableRow key={v.sellerId} className={i === 0 ? "bg-amber-50/60 dark:bg-amber-500/5" : undefined}>
                  <TableCell className="text-center pl-5 text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <AvatarCircle initials={v.initials} color={v.color} />
                      <p className="font-semibold text-foreground">{v.sellerName}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {v.canal ? (
                      <ChannelPill code={CHANNEL_SHORT[v.canal] ?? v.canal} />
                    ) : (
                      <span className="text-muted-foreground">{ordersQuery.isPending ? "…" : "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{v.orderCount}</TableCell>
                  <TableCell className="text-right font-semibold">{v.productsCount}</TableCell>
                  <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">{v.prodOrd.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-semibold">S/ {Math.round(v.averageTicket).toLocaleString("es-PE")}</TableCell>
                  <TableCell className="text-right font-extrabold">S/ {Math.round(v.totalSales).toLocaleString("es-PE")}</TableCell>
                  <TableCell className="text-right pr-5">
                    <span
                      className={cn(
                        "font-bold",
                        v.effectiveness >= 70
                          ? "text-emerald-600 dark:text-emerald-400"
                          : v.effectiveness >= 40
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {v.effectiveness}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-t-2 border-border">
                <TableCell className="pl-5" />
                <TableCell className="font-extrabold">TOTAL</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-extrabold">{vendedoresTotal.orderCount}</TableCell>
                <TableCell className="text-right font-extrabold">{vendedoresTotal.productsCount}</TableCell>
                <TableCell className="text-right font-extrabold text-blue-600 dark:text-blue-400">{vendedoresTotal.prodOrd.toFixed(1)}</TableCell>
                <TableCell className="text-right font-extrabold">S/ {Math.round(vendedoresTotal.averageTicket).toLocaleString("es-PE")}</TableCell>
                <TableCell className="text-right font-extrabold">S/ {Math.round(vendedoresTotal.totalSales).toLocaleString("es-PE")}</TableCell>
                <TableCell className="text-right font-extrabold pr-5">{vendedoresTotal.effectiveness}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <KpiGrid cols={4}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <SectionCard title="Rendimiento por agente ATC" subtitle="Gestión COD/Call Center" contentClassName="px-0">
        {agentesQuery.isPending ? (
          <div className="px-5">
            <SkeletonRows rows={5} />
          </div>
        ) : agentesQuery.isError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-6 text-center">No se pudieron cargar los agentes.</p>
        ) : agentesConDatos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sin agentes con gestiones en el período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Agente</TableHead>
                <TableHead>Canales</TableHead>
                <TableHead className="text-right">Asignados</TableHead>
                <TableHead className="text-right">Confirmados</TableHead>
                <TableHead className="text-right">NC</TableHead>
                <TableHead className="text-right">Anulados</TableHead>
                <TableHead className="text-right">Conv. %</TableHead>
                <TableHead className="text-right">Upsell rate</TableHead>
                <TableHead className="text-right">Upsell S/</TableHead>
                <TableHead className="text-right pr-5">Ticket Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentesConDatos.map((a, i) => (
                <TableRow key={a.id} className={i === 0 ? "bg-amber-50/60 dark:bg-amber-500/5" : undefined}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <AvatarCircle initials={a.initials} color={a.color} size="sm" />
                      <div>
                        <p className="font-semibold text-foreground">{a.nombre ?? "Sin nombre"}</p>
                        {i === 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400">🥇 Top upsell</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.canales.length > 0 ? (
                      <div className="flex gap-1">
                        {a.canales.map((c) => (
                          <ChannelPill key={c} code={CHANNEL_SHORT[c] ?? c} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{ordersQuery.isPending ? "…" : "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{a.asignados}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{a.confirmados}</TableCell>
                  <TableCell className="text-right text-red-600 dark:text-red-400">{ordersQuery.isPending ? "…" : a.nc}</TableCell>
                  <TableCell className="text-right text-red-600 dark:text-red-400">{ordersQuery.isPending ? "…" : a.anulados}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        roundPct(a.pctConfirmados) >= 50
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      )}
                    >
                      {roundPct(a.pctConfirmados)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-violet-600 dark:text-violet-400">{a.upsellRate}%</TableCell>
                  <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">
                    S/ {Math.round(a.upsellMonto).toLocaleString("es-PE")}
                  </TableCell>
                  <TableCell className="text-right pr-5 font-semibold">S/ {Math.round(a.ticketPromedio).toLocaleString("es-PE")}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-extrabold">{agentesTotal.asignados}</TableCell>
                <TableCell className="text-right font-extrabold">{agentesTotal.confirmados}</TableCell>
                <TableCell className="text-right font-extrabold text-red-600 dark:text-red-400">{agentesTotal.nc}</TableCell>
                <TableCell className="text-right font-extrabold text-red-600 dark:text-red-400">{agentesTotal.anulados}</TableCell>
                <TableCell className="text-right font-extrabold">{agentesTotal.conv}%</TableCell>
                <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">{agentesTotal.upsellRate}%</TableCell>
                <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">
                  S/ {Math.round(agentesTotal.upsellMonto).toLocaleString("es-PE")}
                </TableCell>
                <TableCell className="text-right pr-5 font-extrabold">S/ {Math.round(agentesTotal.ticketPromedio).toLocaleString("es-PE")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard title="KPIs Call Center">
          {funnelQuery.isPending ? (
            <SkeletonRows rows={3} />
          ) : funnelQuery.isError || !distribucion ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar el funnel de Call Center.</p>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center justify-between py-2.5 border-b border-border/60">
                <span className="text-sm text-muted-foreground">Tasa confirmación</span>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {roundPct(distribucion.confirmado.percentage)}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({distribucion.confirmado.count} / {distribucion.total})
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/60">
                <span className="text-sm text-muted-foreground">Tasa No Contesta</span>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                    {roundPct(distribucion.noContesta.percentage)}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({distribucion.noContesta.count} / {distribucion.total})
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Tasa anulación</span>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-red-600 dark:text-red-400">
                    {roundPct(distribucion.anulado.percentage)}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({distribucion.anulado.count} / {distribucion.total})
                  </span>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Distribución de gestiones">
          {funnelQuery.isPending ? (
            <SkeletonRows rows={4} />
          ) : funnelQuery.isError || !distribucion ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar el funnel de Call Center.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-3.5">
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">✓ Confirmados</span>
                  <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{distribucion.confirmado.count} ped.</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-red-50 dark:bg-red-500/10">
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">🔴 No Contesta</span>
                  <span className="text-sm font-extrabold text-red-700 dark:text-red-400">{distribucion.noContesta.count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-red-50 dark:bg-red-500/10">
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">✗ Anulados</span>
                  <span className="text-sm font-extrabold text-red-700 dark:text-red-400">{distribucion.anulado.count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">⏳ Pendientes</span>
                  <span className="text-sm font-extrabold text-slate-600 dark:text-slate-400">{distribucion.pendiente.count}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2.5">
                <span className="text-xs font-bold text-violet-700 dark:text-violet-400">TOTAL gestionados CC</span>
                <span className="text-sm font-extrabold text-violet-700 dark:text-violet-400">{distribucion.total} ✓</span>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
