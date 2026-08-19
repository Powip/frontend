"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Download, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { useDashboardBilling } from "@/hooks/useDashboardBilling";
import { useDashboardDailyIncome } from "@/hooks/useDashboardDailyIncome";
import { useDashboardReceivables } from "@/hooks/useDashboardReceivables";
import { useDashboardOrders } from "@/hooks/useDashboardOrders";
import { fetchVariantCost } from "@/services/cierreDiaProductosService";
import { AvatarCircle, esVenta, SectionCard, SkeletonRows } from "./shared";
import { exportTableToExcel } from "./exportExcel";

const ACCENT: Record<string, { border: string; value: string }> = {
  emerald: { border: "border-l-emerald-500", value: "text-emerald-600 dark:text-emerald-400" },
  amber: { border: "border-l-amber-500", value: "text-amber-600 dark:text-amber-400" },
  red: { border: "border-l-red-500 bg-red-50/40 dark:bg-red-500/5", value: "text-red-600 dark:text-red-400" },
  mock: { border: "border-l-red-500 border-2 border-red-500 bg-red-50 dark:bg-red-950/30", value: "text-red-600 dark:text-red-400" },
};

const MONTH_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-pink-500"];

interface FinanzasTabProps {
  fromDate: string;
  toDate: string;
}

export function FinanzasTab({ fromDate, toDate }: FinanzasTabProps) {
  const { selectedStoreId, auth } = useAuth();
  const isAdmin = hasAdminAccess(auth?.user?.role);
  const sellerId = isAdmin ? undefined : auth?.user?.id;
  const year = fromDate ? fromDate.slice(0, 4) : undefined;

  const billingQuery = useDashboardBilling(selectedStoreId, year, sellerId);
  const dailyIncomeQuery = useDashboardDailyIncome(selectedStoreId, fromDate, toDate, sellerId);
  const receivablesQuery = useDashboardReceivables(selectedStoreId, fromDate, toDate, sellerId);
  const ordersQuery = useDashboardOrders(selectedStoreId);

  const billingMonths = useMemo(
    () => (billingQuery.data ?? []).filter((b) => b.currentYear > 0).slice(-5).reverse(),
    [billingQuery.data],
  );
  const maxBillingMonth = Math.max(...billingMonths.map((b) => b.currentYear), 1);

  const [exportingEvolucion, setExportingEvolucion] = useState(false);
  const handleExportEvolucion = async () => {
    setExportingEvolucion(true);
    try {
      const columns = [
        { header: "Mes", width: 16 },
        { header: "Facturación (S/)", width: 18 },
        { header: "Año anterior (S/)", width: 18 },
        { header: "Crecimiento", width: 14 },
      ];
      const rows: (string | number)[][] = billingMonths.map((m) => {
        const growth = m.previousYear > 0 ? Math.round(((m.currentYear - m.previousYear) / m.previousYear) * 100) : null;
        return [m.monthName, Math.round(m.currentYear), Math.round(m.previousYear), growth !== null ? `${growth}%` : "—"];
      });
      await exportTableToExcel("Evolución mensual", "Evolución mensual de facturación", columns, rows, `Finanzas_EvolucionMensual_${year ?? ""}.xlsx`);
    } finally {
      setExportingEvolucion(false);
    }
  };

  const dailyIncome = useMemo(() => dailyIncomeQuery.data ?? [], [dailyIncomeQuery.data]);
  const totalDailyIncome = useMemo(() => dailyIncome.reduce((s, d) => s + d.amount, 0), [dailyIncome]);
  const maxDailyIncome = Math.max(...dailyIncome.map((d) => d.amount), 1);
  const peakDay = useMemo(
    () => dailyIncome.reduce((max, d) => (d.amount > (max?.amount ?? -1) ? d : max), dailyIncome[0]),
    [dailyIncome],
  );
  const lastDay = dailyIncome[dailyIncome.length - 1];

  const receivables = receivablesQuery.data;

  // Ventas del período (confirmados COD + ventas normales, ver esVenta) —
  // misma regla que Resumen General/Comercial, filtrada sobre updated_at.
  const ventasDelPeriodo = useMemo(() => {
    const all = ordersQuery.data ?? [];
    const visible = all.filter((o) => o.status !== "INCOMPLETE" && (o.status as string) !== "PREVENTA");
    return visible.filter((o) => {
      if (!esVenta(o)) return false;
      if (!fromDate || !toDate) return true;
      const dateKey = (o.updated_at ?? o.created_at).slice(0, 10);
      return dateKey >= fromDate && dateKey <= toDate;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  const facturacionVentas = useMemo(
    () => ventasDelPeriodo.reduce((s, o) => s + (parseFloat(o.grandTotal) || 0), 0),
    [ventasDelPeriodo],
  );

  // Costo de mercadería: unidades vendidas × costo por variante (mismo
  // fetchVariantCost que usa Cierre del Día / Top productos de Comercial).
  const productAgg = useMemo(() => {
    const map = new Map<string, number>();
    ventasDelPeriodo.forEach((o) => {
      (o.items ?? []).forEach((it) => {
        map.set(it.productVariantId, (map.get(it.productVariantId) ?? 0) + (it.quantity || 0));
      });
    });
    return map;
  }, [ventasDelPeriodo]);

  const variantIds = useMemo(() => [...productAgg.keys()], [productAgg]);
  const costsQuery = useQuery({
    queryKey: ["dashboard-finanzas-variant-costs", variantIds],
    queryFn: async () => {
      const entries = await Promise.all(variantIds.map(async (id) => [id, await fetchVariantCost(id)] as const));
      return new Map(entries);
    },
    enabled: variantIds.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const costoMercaderia = useMemo(() => {
    const costs = costsQuery.data;
    if (!costs) return null;
    let total = 0;
    productAgg.forEach((units, variantId) => {
      total += (costs.get(variantId) ?? 0) * units;
    });
    return total;
  }, [productAgg, costsQuery.data]);

  const costosLoading = ordersQuery.isPending || costsQuery.isPending;
  const costosError = ordersQuery.isError || costsQuery.isError;

  const finanzasCards = [
    {
      label: "Facturación (Ventas)",
      value: ordersQuery.data ? `S/ ${facturacionVentas.toLocaleString("es-PE")}` : ordersQuery.isError ? "Error" : "—",
      sub: ordersQuery.data ? `${ventasDelPeriodo.length} ped. vendidos` : "Confirmados COD + ventas normales",
      accent: "emerald",
      loading: ordersQuery.isPending,
    },
    {
      label: "Cobrado (aprox.)",
      value: dailyIncomeQuery.data ? `S/ ${totalDailyIncome.toLocaleString("es-PE")}` : dailyIncomeQuery.isError ? "Error" : "—",
      sub: "Suma de ingresos diarios del período",
      accent: "emerald",
      loading: dailyIncomeQuery.isPending,
    },
    {
      label: "COD por Cobrar (en tránsito)",
      value: receivables ? `S/ ${receivables.pendingTotal.toLocaleString("es-PE")}` : receivablesQuery.isError ? "Error" : "—",
      sub: receivables ? `${receivables.pendingOrders.length} pedidos sin liquidar` : "Saldo pendiente",
      accent: "amber",
      loading: receivablesQuery.isPending,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-300/70 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
        <CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-emerald-800 dark:text-emerald-300">Ingresos ≠ Ventas.</span>{" "}
          <span className="text-emerald-700/80 dark:text-emerald-400/80">
            Los <strong>ingresos diarios</strong> son los cobros reales recibidos cada día (pagos, adelantos,
            liquidaciones courier). Son distintos a la <strong>facturación de ventas</strong> (órdenes confirmadas),
            que puede cobrarse en días diferentes.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard title="Distribución mensual de ingresos" subtitle="Facturación por mes (año actual)">
          {billingQuery.isPending ? (
            <SkeletonRows rows={5} />
          ) : billingQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar la facturación mensual.</p>
          ) : billingMonths.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin facturación registrada este año.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {billingMonths.map((m, i) => (
                <div key={m.month} className="flex items-center gap-2.5">
                  <AvatarCircle initials={m.monthName.slice(0, 1).toUpperCase()} color={MONTH_COLORS[i % MONTH_COLORS.length]} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">{m.monthName}</span>
                      <span className="text-xs font-bold text-foreground">S/ {m.currentYear.toLocaleString("es-PE")}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", MONTH_COLORS[i % MONTH_COLORS.length])}
                        style={{ width: `${(m.currentYear / maxBillingMonth) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Detalle de ingresos diarios" subtitle="Cobros recibidos por día (≠ ventas del día)">
          {dailyIncomeQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : dailyIncomeQuery.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400 py-10 text-center">No se pudo cargar los ingresos diarios.</p>
          ) : dailyIncome.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">Sin ingresos registrados en el período.</p>
          ) : (
            <>
              <div className="flex items-end justify-center gap-1 h-24">
                {dailyIncome.map((d) => (
                  <div key={d.date} className="flex-1 max-w-12 h-full flex items-end group relative">
                    <div
                      className="w-full rounded-t bg-emerald-500 transition-opacity group-hover:opacity-80"
                      style={{ height: d.amount === 0 ? "0%" : `${Math.max((d.amount / maxDailyIncome) * 100, 4)}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} · S/
                      {d.amount.toLocaleString("es-PE")}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-1 mt-1">
                {dailyIncome.map((d) => (
                  <span key={`${d.date}-lbl`} className="flex-1 max-w-12 text-center text-[9px] text-muted-foreground">
                    {new Date(`${d.date}T12:00:00`).getDate()}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground">Total período</p>
                  <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    S/ {totalDailyIncome.toLocaleString("es-PE")}
                  </p>
                </div>
                {peakDay && (
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Pico</p>
                    <p className="text-sm font-bold text-foreground">S/ {peakDay.amount.toLocaleString("es-PE")}</p>
                  </div>
                )}
                {lastDay && (
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Últ. día</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">S/ {lastDay.amount.toLocaleString("es-PE")}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-blue-300/70 dark:border-blue-800 bg-blue-50 dark:bg-blue-500/10 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-blue-800 dark:text-blue-300">Reconocimiento de ingreso · COD.</span>{" "}
          <span className="text-blue-700/80 dark:text-blue-400/80">
            Facturación desde Confirmado. Ingreso real (dinero en mano) al momento de Entrega y liquidación courier.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3.5">
        {finanzasCards.map((card) => (
          <div key={card.label} className={cn("rounded-xl border border-border border-l-4 bg-card p-4", ACCENT[card.accent].border)}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{card.label}</p>
            </div>
            {card.loading ? (
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <p className={cn("text-xl font-extrabold tracking-tight", ACCENT[card.accent].value)}>{card.value}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="max-w-xs">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Costo Mercadería</p>
          {costosLoading ? (
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400">
              {costosError ? "Error" : costoMercaderia !== null ? `S/ ${Math.round(costoMercaderia).toLocaleString("es-PE")}` : "—"}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {facturacionVentas > 0 && costoMercaderia !== null
              ? `${Math.round((costoMercaderia / facturacionVentas) * 100)}% del facturado`
              : "Costo por variante × unidades vendidas"}
          </p>
        </div>
      </div>

      <SectionCard
        title="Evolución mensual"
        subtitle="Facturación por mes vs. año anterior"
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={exportingEvolucion || billingMonths.length === 0}
            onClick={handleExportEvolucion}
          >
            {exportingEvolucion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </Button>
        }
      >
        {billingQuery.isPending ? (
          <SkeletonRows rows={5} />
        ) : billingQuery.isError ? (
          <p className="text-xs text-red-600 dark:text-red-400 py-4 text-center">No se pudo cargar la evolución mensual.</p>
        ) : billingMonths.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sin facturación registrada este año.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {billingMonths.map((m, i) => {
              const growth = m.previousYear > 0 ? Math.round(((m.currentYear - m.previousYear) / m.previousYear) * 100) : null;
              return (
                <div key={m.month} className="flex items-center gap-2.5">
                  <span className={cn("min-w-[46px] text-xs", i === 0 ? "font-bold text-emerald-700 dark:text-emerald-400" : "font-medium text-muted-foreground")}>
                    {m.monthName}
                  </span>
                  <span className={cn("h-2 w-2 rounded-full shrink-0", MONTH_COLORS[i % MONTH_COLORS.length])} />
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden relative">
                    <div
                      className={cn("h-full rounded flex items-center pl-2", MONTH_COLORS[i % MONTH_COLORS.length])}
                      style={{ width: `${(m.currentYear / maxBillingMonth) * 100}%` }}
                    >
                      <span className="text-[10px] font-bold text-white truncate">S/ {m.currentYear.toLocaleString("es-PE")}</span>
                    </div>
                  </div>
                  {i === 0 && growth !== null ? (
                    <span
                      className={cn(
                        "text-[11px] font-bold min-w-[38px] text-right",
                        growth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {growth >= 0 ? "+" : ""}
                      {growth}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground min-w-[38px] text-right">
                      {m.currentYear >= 1000 ? `S/${Math.round(m.currentYear / 1000)}k` : `S/${m.currentYear}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
