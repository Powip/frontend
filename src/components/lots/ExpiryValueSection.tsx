"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SELECT_CLASS } from "@/components/compras/PurchaseBits";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { usePdfDownload, useReportAuthor } from "@/hooks/usePdfDownload";
import { lotDay, variantNames } from "@/lib/lots";
import { formatMoney, todayInLima } from "@/lib/purchaseOrders";
import { downloadWorkbook } from "@/lib/reports/excel";
import {
  expiryFilterRows,
  expiryHasCosts,
  expiryLabel,
  expiryPdfSpec,
  expiryTone,
  expiryWorkbook,
  lostByMonthText,
  lostTotal,
  type ExpiryTone,
} from "@/lib/reports/expiry";
import { cn } from "@/lib/utils";
import { getExpiringLots, LOTS_QUERY_KEY, type ExpiringTotals } from "@/services/lotsService";
import { fetchVariantsByIds } from "@/services/variantCodesService";

// FEAT-24 H5-L — «Vencimiento en dinero» (mockup vencHTML, en Alertas): cuánto
// vale lo vencido, lo que vence dentro de los días de aviso y lo que vence
// hasta 90 días, lote por lote, y lo perdido por vencimiento en los últimos 4
// meses. Al costo promedio; sin rol de costos, «••••». Si la empresa no tiene
// lotes por vencer ni mermas por vencimiento, no se muestra.

const DAYS = 90;

const PILL: Record<ExpiryTone, string> = {
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  neutral: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

function Kpi({ label, totals, tone, note }: { label: string; totals: ExpiringTotals; tone?: "bad" | "warn"; note?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "bad" && "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20",
        tone === "warn" && "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{formatMoney(totals.value)}</p>
      <p className="text-xs text-muted-foreground">
        {totals.lots} {totals.lots === 1 ? "lote" : "lotes"} · {totals.units} und{note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}

export default function ExpiryValueSection() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const author = useReportAuthor();
  const downloadPdf = usePdfDownload();
  const { warehouses, nameOf } = useCompanyWarehouses();
  const myWarehouses = useMyWarehouses();
  const warehouseOptions = useMemo(() => myWarehouses.visible(warehouses), [myWarehouses, warehouses]);
  const [inventoryId, setInventoryId] = useState("");
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const expiring = useQuery({
    queryKey: [LOTS_QUERY_KEY, "expiring", companyId, DAYS, inventoryId],
    queryFn: ({ signal }) => getExpiringLots({ days: DAYS, inventoryId: inventoryId || undefined }, signal),
    enabled: Boolean(companyId),
    staleTime: 60_000,
    retry: false,
  });
  const data = expiring.data;
  const variantIds = useMemo(() => [...new Set((data?.items ?? []).map((row) => row.variantId))].sort(), [data]);
  const variants = useQuery({
    queryKey: ["lot-variant-names", companyId, variantIds],
    queryFn: () => fetchVariantsByIds(variantIds, companyId),
    enabled: variantIds.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const names = useMemo(() => variantNames(variants.data ?? []), [variants.data]);

  // Sin lotes por vencer ni pérdidas, y sin filtro: la empresa no usa lotes (o el rol no los ve). No se muestra.
  const lostUnits = (data?.lostByExpiry ?? []).reduce((sum, month) => sum + (Number(month.units) || 0), 0);
  if (!inventoryId && (expiring.isPending || (expiring.isError && !data) || (data && data.items.length === 0 && lostUnits === 0))) return null;

  const costs = data ? expiryHasCosts(data) : false;
  const filters = expiryFilterRows({ inventoryName: inventoryId ? nameOf(inventoryId) : "", days: DAYS, alertDays: data?.alertDays ?? 30 });
  const exportAs = async (kind: "excel" | "pdf") => {
    if (!data) return;
    setExporting(kind);
    setExportError(null);
    try {
      const today = todayInLima();
      if (kind === "excel") await downloadWorkbook(expiryWorkbook(data, { names, filters, generatedBy: author }), `vencimiento-${today}`);
      else await downloadPdf(expiryPdfSpec(data, { names, filters, today }));
    } catch (error) {
      setExportError(`No se pudo descargar el ${kind === "excel" ? "Excel" : "PDF"}. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      setExporting(null);
    }
  };

  return (
    <section id="vencimiento" aria-labelledby="vencimiento-title" className="scroll-mt-20 space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id="vencimiento-title" className="text-base font-semibold">
            Vencimiento en dinero
          </h4>
          <p className="text-xs text-muted-foreground">Al costo. Actúa antes de que venza: promoción, traslado a donde se vende más o merma.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="vencimiento-almacen" className="sr-only">
            Almacén
          </label>
          <select id="vencimiento-almacen" className={cn(SELECT_CLASS, "h-9 w-auto")} value={inventoryId} onChange={(event) => setInventoryId(event.target.value)}>
            <option value="">Todos los almacenes</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || !data} onClick={() => void exportAs("excel")}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {exporting === "excel" ? "Preparando…" : "Descargar Excel"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || !data} onClick={() => void exportAs("pdf")}>
            <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
            {exporting === "pdf" ? "Preparando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>

      {exportError ? (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      ) : null}
      {expiring.isError ? (
        <div role="alert" className="rounded border border-destructive p-3 text-sm">
          No se pudo leer el vencimiento de los lotes.{" "}
          <Button variant="outline" size="sm" onClick={() => void expiring.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {expiring.isFetching && !data ? (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando vencimientos…
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totales de vencimiento">
            <Kpi label="Ya vencido" totals={data.totals.expired} tone="bad" note="no se despacha" />
            <Kpi label={`Vence en ${data.alertDays} días`} totals={data.totals.withinAlert} tone="warn" />
            <Kpi label={`Vence en ${data.alertDays + 1}–${data.days} días`} totals={data.totals.later} />
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Perdido por vencimiento</p>
              <p className="text-xl font-semibold tabular-nums">{formatMoney(lostTotal(data))}</p>
              <p className="text-xs text-muted-foreground">{lostByMonthText(data) || "Sin mermas por vencimiento"}</p>
            </div>
          </div>
          {costs && data.totals.all.withoutCost?.lots ? (
            <p className="text-xs text-muted-foreground">
              {data.totals.all.withoutCost.lots} {data.totals.all.withoutCost.lots === 1 ? "lote no tiene" : "lotes no tienen"} costo: no suman al valor.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Producto</th>
                  <th className="px-3 py-2 text-left font-medium">Lote</th>
                  <th className="px-3 py-2 text-left font-medium">Almacén</th>
                  <th className="px-3 py-2 text-left font-medium">Vence</th>
                  <th className="px-3 py-2 text-right font-medium">Unidades</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Nada vence en los próximos {data.days} días.
                    </td>
                  </tr>
                ) : (
                  data.items.map((row) => {
                    const variant = names.get(row.variantId);
                    return (
                      <tr key={`${row.lotId}|${row.inventoryId}`} className="border-t" data-testid={`vence-${row.lotId}-${row.inventoryId}`}>
                        <td className="px-3 py-2">
                          <p>{variant?.name ?? (variants.isPending ? "…" : "Variante")}</p>
                          {variant?.sku ? <p className="font-mono text-xs text-muted-foreground">{variant.sku}</p> : null}
                        </td>
                        <td className="px-3 py-2 font-mono">{row.lotNumber}</td>
                        <td className="px-3 py-2">{row.inventoryName || nameOf(row.inventoryId)}</td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", PILL[expiryTone(row, data.alertDays)])}>
                            {expiryLabel(row)}
                          </span>
                          {row.expiresAt ? <span className="ml-2 text-xs text-muted-foreground">{lotDay(row.expiresAt)}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.value)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {data.truncated ? <p className="text-xs text-muted-foreground">Hay más lotes de los que se muestran: filtra por almacén.</p> : null}
        </>
      ) : null}
    </section>
  );
}
