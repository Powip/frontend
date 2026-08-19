"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { hasAdminAccess } from "@/config/permissions.config";
import { useDashboardByChannel } from "@/hooks/useDashboardByChannel";
import { useCcUpsell } from "@/hooks/useCcUpsell";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import { useUpsellRecords } from "@/hooks/useUpsellRecords";
import { fetchVariantCost } from "@/services/cierreDiaProductosService";
import { ChannelPill, CHANNEL_SHORT, esVenta, KpiCard, KpiGrid, SectionCard, SkeletonRows } from "./shared";
import { exportTableToExcel } from "./exportExcel";

interface ComercialTabProps {
  fromDate: string;
  toDate: string;
}

function marginClass(pct: number): string {
  if (pct >= 45) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (pct >= 25) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
}

interface ChannelStats {
  totalOrders: number;
  ventaOrders: number;
  unidades: number;
  upsellMonto: number;
}

export function ComercialTab({ fromDate, toDate }: ComercialTabProps) {
  const { selectedStoreId, auth } = useAuth();
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const sellerId = isAdmin ? undefined : auth?.user?.id;

  const range: DateRange | undefined = useMemo(() => {
    if (!fromDate || !toDate) return undefined;
    return { from: new Date(`${fromDate}T00:00:00`), to: new Date(`${toDate}T23:59:59`) };
  }, [fromDate, toDate]);

  const channelQuery = useDashboardByChannel(selectedStoreId, fromDate, toDate, sellerId);
  const upsellQuery = useCcUpsell(selectedStoreId, range);
  const ordersQuery = useDashboardOrders(selectedStoreId);
  const upsellRecordsQuery = useUpsellRecords(selectedStoreId, range);

  const channels = useMemo(
    () => [...(channelQuery.data?.salesChannels ?? [])].sort((a, b) => b.totalAmount - a.totalAmount),
    [channelQuery.data],
  );
  const channelsTotal = useMemo(
    () => ({
      pedidos: channels.reduce((s, c) => s + c.ordersCount, 0),
      facturacion: channels.reduce((s, c) => s + c.totalAmount, 0),
    }),
    [channels],
  );
  const upsell = upsellQuery.data;

  // Pedidos ingresados en el período (por created_at, igual criterio que
  // Operaciones) — base para efectividad por canal (ventas / ingresados).
  const ordersInPeriod = useMemo(() => {
    const all = ordersQuery.data ?? [];
    const visible = all.filter((o) => o.status !== "INCOMPLETE" && (o.status as string) !== "PREVENTA");
    if (!fromDate || !toDate) return visible;
    return visible.filter((o) => {
      const d = o.created_at.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  const ventasDelPeriodo = useMemo(() => ordersInPeriod.filter(esVenta), [ordersInPeriod]);

  const channelStats = useMemo(() => {
    const map = new Map<string, ChannelStats>();
    ordersInPeriod.forEach((o) => {
      const key = o.salesChannel ?? "OTRO";
      const entry = map.get(key) ?? { totalOrders: 0, ventaOrders: 0, unidades: 0, upsellMonto: 0 };
      entry.totalOrders += 1;
      if (esVenta(o)) {
        entry.ventaOrders += 1;
        entry.unidades += (o.items ?? []).reduce((s, it) => s + (it.quantity || 0), 0);
      }
      map.set(key, entry);
    });
    const orderChannelMap = new Map(ordersInPeriod.map((o) => [o.orderNumber, o.salesChannel ?? "OTRO"]));
    (upsellRecordsQuery.data?.items ?? []).forEach((it) => {
      const ch = orderChannelMap.get(it.orderNumber);
      if (!ch) return;
      const entry = map.get(ch);
      if (entry) entry.upsellMonto += it.subtotal;
    });
    return map;
  }, [ordersInPeriod, upsellRecordsQuery.data]);

  const mejorEfectividad = useMemo(() => {
    const candidates = [...channelStats.entries()]
      .filter(([, stats]) => stats.totalOrders > 0)
      .map(([channel, stats]) => ({ channel, pct: (stats.ventaOrders / stats.totalOrders) * 100 }));
    if (candidates.length === 0) return null;
    return candidates.reduce((best, c) => (c.pct > best.pct ? c : best));
  }, [channelStats]);

  const prodPromedioGlobal = useMemo(() => {
    let orders = 0;
    let units = 0;
    channelStats.forEach((stats) => {
      orders += stats.ventaOrders;
      units += stats.unidades;
    });
    return orders > 0 ? units / orders : 0;
  }, [channelStats]);

  const canalesFuenteLista = !ordersQuery.isPending && !ordersQuery.isError;

  const kpis = [
    {
      label: "Facturación Neta",
      value: channels.length ? `S/ ${channelsTotal.facturacion.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : channelQuery.isError ? "Error" : "—",
      sub: channels.length ? `${channelsTotal.pedidos} ped. · por canal` : "Suma de canales",
      primary: true,
      loading: channelQuery.isPending,
    },
    {
      label: "Upsell Total",
      value: upsell ? `S/ ${upsell.consolidado.upsellMonto.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : upsellQuery.isError ? "Error" : "—",
      sub: upsell ? `${upsell.consolidado.pctSobreBase}% del facturado` : "Gestión COD",
      valueClassName: "text-violet-600 dark:text-violet-400",
      loading: upsellQuery.isPending,
    },
    {
      label: "Canal Top",
      value: channels[0] ? channels[0].channel.replace(/_/g, " ") : channelQuery.isError ? "Error" : "—",
      sub: channels[0] ? `${channels[0].ordersCount} ped. · S/${channels[0].totalAmount.toLocaleString("es-PE")}` : "Por facturación",
      loading: channelQuery.isPending,
    },
    {
      label: "Mejor Efectividad",
      value: mejorEfectividad ? `${Math.round(mejorEfectividad.pct)}%` : ordersQuery.isError ? "Error" : "—",
      sub: mejorEfectividad ? mejorEfectividad.channel.replace(/_/g, " ") : "Ventas / pedidos ingresados",
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      loading: ordersQuery.isPending,
    },
    {
      label: "Prod. Prom./Pedido",
      value: canalesFuenteLista ? prodPromedioGlobal.toFixed(1) : ordersQuery.isError ? "Error" : "—",
      sub: "Promedio global",
      loading: ordersQuery.isPending,
    },
  ];

  // Agregado por producto a partir de las mismas ventas del período (confirmados
  // COD + ventas normales, ver esVenta) — no de Cierre del Día, que solo cubre
  // pedidos que pasaron por Gestión CC y queda vacío para tiendas donde la
  // mayoría de ventas son "normales" (no-COD).
  interface ProductAgg {
    productVariantId: string;
    nombre: string;
    sku: string;
    unidades: number;
    ingreso: number;
    canales: Set<string>;
  }
  const productAgg = useMemo(() => {
    const map = new Map<string, ProductAgg>();
    ventasDelPeriodo.forEach((o) => {
      (o.items ?? []).forEach((it) => {
        const entry = map.get(it.productVariantId) ?? {
          productVariantId: it.productVariantId,
          nombre: it.productName,
          sku: it.sku,
          unidades: 0,
          ingreso: 0,
          canales: new Set<string>(),
        };
        entry.unidades += it.quantity || 0;
        entry.ingreso += parseFloat(it.subtotal) || 0;
        entry.canales.add(o.salesChannel ?? "OTRO");
        map.set(it.productVariantId, entry);
      });
    });
    return map;
  }, [ventasDelPeriodo]);

  const variantIds = useMemo(() => [...productAgg.keys()], [productAgg]);
  const costsQuery = useQuery({
    queryKey: ["dashboard-product-variant-costs", variantIds],
    queryFn: async () => {
      const entries = await Promise.all(variantIds.map(async (id) => [id, await fetchVariantCost(id)] as const));
      return new Map(entries);
    },
    enabled: variantIds.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const upsellBySku = useMemo(() => {
    const map = new Map<string, number>();
    (upsellRecordsQuery.data?.items ?? []).forEach((it) => {
      map.set(it.sku, (map.get(it.sku) ?? 0) + it.subtotal);
    });
    return map;
  }, [upsellRecordsQuery.data]);

  const productsLoading = ordersQuery.isPending || costsQuery.isPending;
  const productsError = ordersQuery.isError || costsQuery.isError;

  const productRows = useMemo(() => {
    const costs = costsQuery.data;
    return [...productAgg.values()]
      .map((p) => {
        const costoUnit = costs?.get(p.productVariantId) ?? 0;
        const costo = costoUnit * p.unidades;
        const margen = p.ingreso - costo;
        return {
          sku: p.sku,
          nombre: p.nombre,
          unidades: p.unidades,
          canales: [...p.canales],
          ingreso: p.ingreso,
          upsell: upsellBySku.get(p.sku) ?? 0,
          costoUnit,
          pctMargen: p.ingreso ? (margen / p.ingreso) * 100 : 0,
        };
      })
      .sort((a, b) => b.ingreso - a.ingreso)
      .slice(0, 10);
  }, [productAgg, costsQuery.data, upsellBySku]);

  const productTotals = useMemo(
    () => ({
      unidades: [...productAgg.values()].reduce((s, p) => s + p.unidades, 0),
      ingreso: [...productAgg.values()].reduce((s, p) => s + p.ingreso, 0),
      upsell: [...upsellBySku.values()].reduce((s, v) => s + v, 0),
    }),
    [productAgg, upsellBySku],
  );

  const [exportingCanales, setExportingCanales] = useState(false);
  const handleExportCanales = async () => {
    setExportingCanales(true);
    try {
      const columns = [
        { header: "Canal", width: 22 },
        { header: "Pedidos", width: 12 },
        { header: "Ticket prom. (S/)", width: 16 },
        { header: "Prod./pedido", width: 14 },
        { header: "Facturación neta (S/)", width: 20 },
        { header: "Efectividad", width: 14 },
        { header: "Upsell (S/)", width: 14 },
      ];
      const rows: (string | number)[][] = channels.map((row) => {
        const stats = channelStats.get(row.channel);
        const prodPorPedido = stats && stats.ventaOrders > 0 ? stats.unidades / stats.ventaOrders : null;
        const efectividad = stats && stats.totalOrders > 0 ? (stats.ventaOrders / stats.totalOrders) * 100 : null;
        return [
          row.channel.replace(/_/g, " "),
          row.ordersCount,
          row.ordersCount > 0 ? Math.round(row.totalAmount / row.ordersCount) : 0,
          prodPorPedido !== null ? Number(prodPorPedido.toFixed(1)) : "—",
          Math.round(row.totalAmount),
          efectividad !== null ? `${Math.round(efectividad)}%` : "—",
          stats ? Math.round(stats.upsellMonto) : 0,
        ];
      });
      await exportTableToExcel(
        "Canales",
        `Confirmados y facturación por canal (${fromDate} a ${toDate})`,
        columns,
        rows,
        `Comercial_Canales_${fromDate}_a_${toDate}.xlsx`,
      );
    } finally {
      setExportingCanales(false);
    }
  };

  const [exportingProductos, setExportingProductos] = useState(false);
  const handleExportProductos = async () => {
    setExportingProductos(true);
    try {
      const columns = [
        { header: "Producto", width: 30 },
        { header: "SKU", width: 16 },
        { header: "Unidades", width: 12 },
        { header: "Canales", width: 16 },
        { header: "Facturación neta (S/)", width: 20 },
        { header: "Upsell (S/)", width: 14 },
        { header: "Costo unit. (S/)", width: 16 },
        { header: "Margen", width: 12 },
      ];
      const rows: (string | number)[][] = productRows.map((row) => [
        row.nombre,
        row.sku,
        row.unidades,
        row.canales.join(", "),
        Math.round(row.ingreso),
        Math.round(row.upsell),
        Math.round(row.costoUnit),
        `${Math.round(row.pctMargen)}%`,
      ]);
      await exportTableToExcel(
        "Top productos",
        `Top productos del período (${fromDate} a ${toDate})`,
        columns,
        rows,
        `Comercial_TopProductos_${fromDate}_a_${toDate}.xlsx`,
      );
    } finally {
      setExportingProductos(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <KpiGrid cols={5}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <SectionCard
        title="Confirmados y facturación por canal"
        subtitle="Pedidos, ticket, facturación, prod./pedido, efectividad y upsell del período"
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={exportingCanales || channels.length === 0}
            onClick={handleExportCanales}
          >
            {exportingCanales ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </Button>
        }
        contentClassName="px-0"
      >
        {channelQuery.isPending ? (
          <div className="px-5">
            <SkeletonRows rows={5} />
          </div>
        ) : channelQuery.isError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-6 text-center">No se pudo cargar el canal de origen.</p>
        ) : channels.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sin datos para el período seleccionado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Canal</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Ticket prom.</TableHead>
                <TableHead className="text-right">Prod./pedido</TableHead>
                <TableHead className="text-right">Facturación neta</TableHead>
                <TableHead className="text-right">Efectividad</TableHead>
                <TableHead className="text-right pr-5">Upsell S/</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((row) => {
                const stats = channelStats.get(row.channel);
                const prodPorPedido = stats && stats.ventaOrders > 0 ? stats.unidades / stats.ventaOrders : null;
                const efectividad = stats && stats.totalOrders > 0 ? (stats.ventaOrders / stats.totalOrders) * 100 : null;
                return (
                  <TableRow key={row.channel}>
                    <TableCell className="pl-5 font-semibold">{row.channel.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-semibold">{row.ordersCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      S/ {row.ordersCount > 0 ? Math.round(row.totalAmount / row.ordersCount).toLocaleString("es-PE") : 0}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {prodPorPedido !== null ? prodPorPedido.toFixed(1) : ordersQuery.isPending ? "…" : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold">S/ {Math.round(row.totalAmount).toLocaleString("es-PE")}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right",
                        efectividad === null
                          ? "text-muted-foreground"
                          : efectividad >= 70
                            ? "text-emerald-600 dark:text-emerald-400"
                            : efectividad >= 50
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {efectividad !== null ? `${Math.round(efectividad)}%` : ordersQuery.isPending ? "…" : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground pr-5">
                      {stats ? `S/ ${Math.round(stats.upsellMonto).toLocaleString("es-PE")}` : upsellRecordsQuery.isPending ? "…" : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
                <TableCell className="text-right font-extrabold">{channelsTotal.pedidos}</TableCell>
                <TableCell className="text-right font-extrabold">
                  S/ {channelsTotal.pedidos > 0 ? Math.round(channelsTotal.facturacion / channelsTotal.pedidos).toLocaleString("es-PE") : 0}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {canalesFuenteLista ? prodPromedioGlobal.toFixed(1) : "—"}
                </TableCell>
                <TableCell className="text-right font-extrabold">S/ {Math.round(channelsTotal.facturacion).toLocaleString("es-PE")}</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground pr-5">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard
        title="Top productos del período"
        subtitle="Top 10 por facturación · pedidos vendidos (confirmados COD + ventas normales)"
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={exportingProductos || productRows.length === 0}
            onClick={handleExportProductos}
          >
            {exportingProductos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </Button>
        }
        contentClassName="px-0"
      >
        {productsLoading ? (
          <div className="px-5">
            <SkeletonRows rows={5} />
          </div>
        ) : productsError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-6 text-center">No se pudo cargar el top de productos.</p>
        ) : productRows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Sin productos vendidos en el período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Producto</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead>Canales</TableHead>
                <TableHead className="text-right">Facturación neta</TableHead>
                <TableHead className="text-right">Upsell S/</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="text-right pr-5">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productRows.map((row) => (
                <TableRow key={row.sku}>
                  <TableCell className="pl-5 font-semibold">{row.nombre}</TableCell>
                  <TableCell className="text-right">{row.unidades}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {row.canales.map((c) => (
                        <ChannelPill key={c} code={CHANNEL_SHORT[c] ?? c} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold">S/ {Math.round(row.ingreso).toLocaleString("es-PE")}</TableCell>
                  <TableCell className="text-right font-semibold text-violet-600 dark:text-violet-400">
                    S/ {Math.round(row.upsell).toLocaleString("es-PE")}
                  </TableCell>
                  <TableCell className="text-right text-amber-600 dark:text-amber-400 font-medium">
                    S/ {row.costoUnit.toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", marginClass(row.pctMargen))}>
                      {Math.round(row.pctMargen)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
                <TableCell className="text-right font-extrabold">{productTotals.unidades}</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-extrabold">
                  S/ {Math.round(productTotals.ingreso).toLocaleString("es-PE")}
                </TableCell>
                <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">
                  S/ {Math.round(productTotals.upsell).toLocaleString("es-PE")}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground pr-5">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
