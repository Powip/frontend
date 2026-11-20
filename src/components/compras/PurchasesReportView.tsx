"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Download, FileText, Info } from "lucide-react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePdfDownload, useReportAuthor } from "@/hooks/usePdfDownload";
import { getPurchasesReport, type PurchasesReport } from "@/services/inventoryReportsService";
import { trackingError } from "@/services/inventoryTrackingService";
import { formatMoney } from "@/lib/purchaseOrders";
import { downloadWorkbook } from "@/lib/reports/excel";
import { formatYmd, PURCHASES_PERIOD_OPTIONS, purchasesRange, shortPeriodLabel, type PurchasesPeriodKind } from "@/lib/reports/periods";
import { productSuppliers, purchasesHaveAmounts, purchasesReportPdfSpec, purchasesReportWorkbook } from "@/lib/reports/purchasesReport";
import { Money, PurchasesNav } from "./PurchaseBits";

// FEAT-24 H10-D7 — Compras › Reporte de compras (mockup vComRep): cuánto se
// compró en el periodo, a quién y qué; serie mensual, tops por proveedor,
// producto, marca y categoría, con Excel y PDF. Montos sin IGV.

const pct = (share: number | undefined) => (typeof share === "number" ? `${Math.round(share * 100)}%` : "—");
const compactSoles = new Intl.NumberFormat("es-PE", { notation: "compact", maximumFractionDigits: 1 });

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ShareBar({ share }: { share: number | undefined }) {
  if (typeof share !== "number") return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }} />
      </div>
      <span className="tabular-nums text-xs">{pct(share)}</span>
    </div>
  );
}

interface MonthDatum {
  month: string;
  label: string;
  value: number;
  amount?: number;
  units: number;
  orders: number;
}

function MonthTooltip({ active, payload }: TooltipContentProps<number, string>) {
  const datum = active ? (payload?.[0]?.payload as MonthDatum | undefined) : undefined;
  if (!datum) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{datum.label}</p>
      {"amount" in datum ? <p>Monto: {formatMoney(datum.amount)}</p> : null}
      <p>Unidades: {datum.units}</p>
      <p>Órdenes: {datum.orders}</p>
    </div>
  );
}

/** Serie mensual: el monto si el rol lo ve; si no, las unidades. Una sola serie: sin leyenda, el título la nombra. */
function MonthlyChart({ report }: { report: PurchasesReport }) {
  const amounts = purchasesHaveAmounts(report);
  const data: MonthDatum[] = report.byMonth.map((row) => ({
    month: row.month,
    label: shortPeriodLabel(row.month),
    value: amounts ? row.amount ?? 0 : row.units,
    ...(amounts ? { amount: row.amount } : {}),
    units: row.units,
    orders: row.orders,
  }));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Sin compras en el periodo.</p>;
  return (
    <figure className="m-0" aria-label={amounts ? "Compras por mes, monto sin IGV" : "Compras por mes, unidades"}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(value: number) => (amounts ? `S/ ${compactSoles.format(value)}` : compactSoles.format(value))}
            />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={MonthTooltip} />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Detalle por mes en la tabla «Por mes».</figcaption>
    </figure>
  );
}

export default function PurchasesReportView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const author = useReportAuthor();
  const downloadPdf = usePdfDownload();
  const [kind, setKind] = useState<PurchasesPeriodKind>("mes");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const range = purchasesRange(kind, custom);

  const report = useQuery({
    queryKey: ["purchases-report", companyId, range.from, range.to],
    queryFn: ({ signal }) => getPurchasesReport({ from: range.from, to: range.to }, signal),
    enabled: Boolean(companyId && auth?.accessToken) && !range.error,
    retry: false,
  });
  const data = report.data;
  const amounts = data ? purchasesHaveAmounts(data) : false;
  const suppliersByProduct = data ? productSuppliers(data) : new Map<string, string[]>();

  const exportReport = async (format: "excel" | "pdf") => {
    if (!data) return;
    setExporting(format);
    setExportError(null);
    try {
      if (format === "excel") await downloadWorkbook(purchasesReportWorkbook(data, { rangeLabel: range.label, generatedBy: author }), `reporte-compras-${data.from}-${data.to}`);
      else await downloadPdf(purchasesReportPdfSpec(data, { rangeLabel: range.label }));
    } catch (error) {
      setExportError(`No se pudo descargar el ${format === "excel" ? "Excel" : "PDF"}. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="w-full px-4 pb-6 md:px-6">
      <HeaderConfig title="Compras" description="Cuánto se compró, a quién y qué" />
      <div className="mb-4">
        <PurchasesNav />
      </div>

      <div className="mb-4 flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="text-foreground">Reporte de compras:</strong> cuánto se compró en el periodo, a qué proveedores y qué productos. Montos sin IGV. Sale de las
          órdenes de compra emitidas y de las compras directas; no cuentan borradores ni anuladas.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex flex-wrap rounded-md border p-0.5" role="group" aria-label="Periodo">
            {PURCHASES_PERIOD_OPTIONS.map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={kind === value ? "default" : "ghost"} aria-pressed={kind === value} onClick={() => setKind(value)}>
                {label}
              </Button>
            ))}
          </div>
          {kind === "rango" ? (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="purchases-from" className="text-xs">Desde</Label>
                <Input id="purchases-from" type="date" className="h-9" value={custom.from} onChange={(event) => setCustom((prev) => ({ ...prev, from: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="purchases-to" className="text-xs">Hasta</Label>
                <Input id="purchases-to" type="date" className="h-9" value={custom.to} onChange={(event) => setCustom((prev) => ({ ...prev, to: event.target.value }))} />
              </div>
            </div>
          ) : (
            <p className="pb-2 text-sm text-muted-foreground">{range.label} · {formatYmd(range.from)} al {formatYmd(range.to)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!data || !!exporting} onClick={() => void exportReport("excel")}>
            <Download className="mr-2 h-4 w-4" />
            {exporting === "excel" ? "Preparando…" : "Descargar Excel"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!data || !!exporting} onClick={() => void exportReport("pdf")}>
            <FileText className="mr-2 h-4 w-4" />
            {exporting === "pdf" ? "Preparando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>

      {range.error ? <p role="alert" className="mb-3 text-sm text-destructive">{range.error}</p> : null}
      {exportError ? <p role="alert" className="mb-3 text-sm text-destructive">{exportError}</p> : null}
      {report.error ? (
        <div role="alert" className="mb-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {trackingError(report.error, "No se pudo cargar el reporte de compras.")}{" "}
          <Button variant="outline" size="sm" onClick={() => void report.refetch()}>Reintentar</Button>
        </div>
      ) : null}
      {report.isFetching && !data ? <p role="status" className="text-sm text-muted-foreground">Cargando reporte…</p> : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Total comprado" value={<Money value={data.totals.amount} />} hint="Sin IGV" />
            <Kpi label="Órdenes" value={data.totals.orders} hint={<>Ticket promedio <Money value={data.totals.averageTicket} /></>} />
            <Kpi label="Unidades" value={data.totals.units} />
            <Kpi label="Proveedores" value={data.totals.suppliers} hint={data.topSupplier ? `Principal: ${data.topSupplier.supplierName || "Sin proveedor"}` : undefined} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{amounts ? "Compras por mes" : "Unidades compradas por mes"}</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyChart report={data} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proveedores a los que más se compra</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Proveedores">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Proveedor</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2 text-left">Participación</th>
                    <th className="p-2 text-right">Órdenes</th>
                    <th className="p-2 text-left">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySupplier.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sin compras en el periodo.</td></tr>
                  ) : data.bySupplier.map((row) => (
                    <tr key={row.supplierId ?? "sin-proveedor"} className="border-t">
                      <td className="p-2">{row.supplierName || "Sin proveedor"}</td>
                      <td className="p-2 text-right"><Money value={row.amount} /></td>
                      <td className="p-2"><ShareBar share={row.share} /></td>
                      <td className="p-2 text-right tabular-nums">{row.orders}</td>
                      <td className="p-2">{formatYmd(row.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos más comprados</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Productos más comprados">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-right">Unidades</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2 text-right">Costo prom.</th>
                    <th className="p-2 text-left">Proveedores</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sin compras en el periodo.</td></tr>
                  ) : data.topProducts.map((row) => (
                    <tr key={row.productId ?? row.productName ?? "sin-producto"} className="border-t">
                      <td className="p-2">{row.productName || "Producto fuera del catálogo"}</td>
                      <td className="p-2 text-right tabular-nums">{row.units}</td>
                      <td className="p-2 text-right"><Money value={row.amount} /></td>
                      <td className="p-2 text-right"><Money value={typeof row.amount === "number" ? (row.units > 0 ? row.amount / row.units : null) : undefined} decimals={4} /></td>
                      <td className="p-2 text-muted-foreground">{(row.productId ? suppliersByProduct.get(row.productId) : undefined)?.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {([
              ["Por marca", data.byBrand.map((row) => ({ key: row.brandId ?? "sin-marca", name: row.brandName || "Sin marca", ...row }))],
              ["Por categoría", data.byCategory.map((row) => ({ key: row.categoryId ?? "sin-categoria", name: row.categoryName || "Sin categoría", ...row }))],
            ] as const).map(([title, rows]) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label={title}>
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">{title === "Por marca" ? "Marca" : "Categoría"}</th>
                        <th className="p-2 text-right">Unidades</th>
                        <th className="p-2 text-right">Monto</th>
                        <th className="p-2 text-left">Participación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sin compras en el periodo.</td></tr>
                      ) : rows.map((row) => (
                        <tr key={row.key} className="border-t">
                          <td className="p-2">{row.name}</td>
                          <td className="p-2 text-right tabular-nums">{row.units}</td>
                          <td className="p-2 text-right"><Money value={row.amount} /></td>
                          <td className="p-2"><ShareBar share={row.share} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por mes</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Por mes">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Mes</th>
                    <th className="p-2 text-right">Monto</th>
                    <th className="p-2 text-right">Unidades</th>
                    <th className="p-2 text-right">Órdenes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byMonth.map((row) => (
                    <tr key={row.month} className="border-t">
                      <td className="p-2">{shortPeriodLabel(row.month)}</td>
                      <td className="p-2 text-right"><Money value={row.amount} /></td>
                      <td className="p-2 text-right tabular-nums">{row.units}</td>
                      <td className="p-2 text-right tabular-nums">{row.orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
