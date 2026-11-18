"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { useCompanyWarehouses } from "@/hooks/useCompanyWarehouses";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { usePdfDownload, useReportAuthor } from "@/hooks/usePdfDownload";
import { getStockReport, getValuation, type StockReportData, type ValuationData } from "@/services/inventoryReportsService";
import { formatMoney, MASK, todayInLima } from "@/lib/purchaseOrders";
import {
  cellFor,
  reportHasCosts,
  reportSku,
  reportVariantLabel,
  reportWarehouses,
  sourceText,
  stockReportFilterRows,
  stockReportPdfSpec,
  stockReportWorkbook,
  valuationRows,
  type StockReportFilterState,
} from "@/lib/reports/stockReport";
import { downloadWorkbook } from "@/lib/reports/excel";
import { formatYmd } from "@/lib/reports/periods";
import { SELECT_CLASS } from "@/components/compras/PurchaseBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// FEAT-24 H10-D3 — Inventario › Reporte general (mockup vReporte): todas las
// variantes por todos los almacenes a una fecha, con el valorizado arriba
// (H10-D2: por almacén, total y lo «sin costo» aparte). Sin rol de costos la
// fachada omite los valores: las columnas de valor no se muestran.

const PAGE_SIZE = 50;

function useDebounced<T>(value: T, ms = 300): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return current;
}

function UnavailableNotice({ message, cutoffAt }: { message: string; cutoffAt: string | null }) {
  return (
    <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">Sin historial antes del corte</p>
      <p>{message}</p>
      {cutoffAt ? <p className="mt-1">El libro de stock empieza el {formatYmd(cutoffAt)}: elige una fecha desde ese día.</p> : null}
    </div>
  );
}

function ValuationCard({ valuation }: { valuation: ValuationData }) {
  const rows = valuationRows(valuation);
  const withoutCost = valuation.totals.withoutCost;
  return (
    <section aria-label="Valorizado" className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Valor del inventario</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney("value" in valuation.totals ? valuation.totals.value ?? null : undefined)}</p>
          <p className="text-xs text-muted-foreground">Costo promedio × físico, sin IGV</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Unidades</p>
          <p className="text-2xl font-semibold tabular-nums">{valuation.totals.units}</p>
          <p className="text-xs text-muted-foreground">{valuation.totals.variants} variantes con stock</p>
        </div>
        <div className={cn("rounded-lg border bg-card p-4", withoutCost.variants > 0 && "border-amber-300")}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Sin costo</p>
          <p className="text-2xl font-semibold tabular-nums">{withoutCost.variants}</p>
          <p className="text-xs text-muted-foreground">{withoutCost.variants > 0 ? `variantes (${withoutCost.units} und) que no suman al valor` : "Todo tiene costo"}</p>
        </div>
      </div>
      {rows.length > 1 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Sin costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.inventoryId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.units}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(row.value)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.withoutCostItems ? `${row.withoutCostItems} (${row.withoutCostUnits} und)` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}

export default function StockReportTab() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  const canSeeCosts = canSeeProductCosts(auth?.user);
  const author = useReportAuthor();
  const downloadPdf = usePdfDownload();
  const { warehouses, nameOf } = useCompanyWarehouses();
  // FEAT-24 H6: el filtro ofrece solo los almacenes que el usuario ve (el backend igual acota el reporte).
  const myWarehouses = useMyWarehouses();
  const warehouseOptions = useMemo(() => myWarehouses.visible(warehouses), [myWarehouses, warehouses]);
  const today = todayInLima();

  const [date, setDate] = useState("");
  const [inventoryId, setInventoryId] = useState("");
  const [qDraft, setQDraft] = useState("");
  const q = useDebounced(qDraft);
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [detail, setDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const filterState: StockReportFilterState = { date, inventoryId, q, onlyWithStock };
  const filters = useMemo(() => ({ date: date || undefined, inventoryId: inventoryId || undefined, q: q.trim() || undefined, onlyWithStock }), [date, inventoryId, q, onlyWithStock]);
  useEffect(() => setPage(1), [filters]);
  const dateError = date && date > today ? "La fecha no puede ser futura." : null;
  const enabled = Boolean(companyId && userId && auth?.accessToken) && !dateError;

  const report = useQuery({
    queryKey: ["inventory-report-stock", companyId, userId, filters, page],
    queryFn: ({ signal }) => getStockReport({ ...filters, page, limit: PAGE_SIZE }, signal),
    enabled,
    retry: false,
  });
  const valuation = useQuery({
    queryKey: ["inventory-report-valuation", companyId, userId, filters.date, filters.inventoryId],
    queryFn: ({ signal }) => getValuation({ date: filters.date, inventoryId: filters.inventoryId }, signal),
    enabled,
    retry: false,
  });

  const data = report.data && report.data.available ? (report.data as StockReportData) : null;
  const unavailable = report.data && !report.data.available ? report.data : null;
  const columns = data ? reportWarehouses(data, inventoryId) : [];
  const showValues = Boolean(data && canSeeCosts && reportHasCosts(data));
  const live = data?.source === "live";

  const exportAll = async (kind: "excel" | "pdf") => {
    setExporting(kind);
    setExportError(null);
    try {
      const all = await getStockReport({ ...filters, all: true });
      if (!all.available) throw new Error(all.message);
      const rows = stockReportFilterRows(filterState, nameOf);
      if (kind === "excel") {
        await downloadWorkbook(stockReportWorkbook(all, { filters: rows, canSeeCosts, inventoryId, generatedBy: author }), `reporte-general-${all.date}`);
      } else {
        await downloadPdf(stockReportPdfSpec(all, { filters: rows, canSeeCosts, inventoryId }));
      }
    } catch (error) {
      setExportError(`No se pudo descargar el ${kind === "excel" ? "Excel" : "PDF"}. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      setExporting(null);
    }
  };

  const numericHead = "text-right";
  const totalCols = 4 + columns.length + 3 + (live ? 2 : 0) + (showValues ? 2 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Reporte general</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Todas las variantes por todos tus almacenes, en una sola tabla. El stock a una fecha pasada sale del cierre mensual o del libro de stock, para que el contador vea siempre lo mismo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || !data} onClick={() => void exportAll("excel")}>
            <Download className="mr-2 h-4 w-4" />
            {exporting === "excel" ? "Preparando…" : "Descargar Excel"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || !data} onClick={() => void exportAll("pdf")}>
            <FileText className="mr-2 h-4 w-4" />
            {exporting === "pdf" ? "Preparando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border/50 bg-muted/40 p-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="report-date" className="text-xs font-semibold uppercase text-muted-foreground/70">Stock al</Label>
          <div className="flex gap-2">
            <Input id="report-date" type="date" className="h-9" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
            {date ? <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setDate("")}>Hoy</Button> : null}
          </div>
        </div>
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="report-warehouse" className="text-xs font-semibold uppercase text-muted-foreground/70">Almacén</Label>
          <select id="report-warehouse" className={SELECT_CLASS} value={inventoryId} onChange={(event) => setInventoryId(event.target.value)}>
            <option value="">Todos los almacenes</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.status === false ? " (inactivo)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col space-y-1.5 lg:col-span-2">
          <Label htmlFor="report-q" className="text-xs font-semibold uppercase text-muted-foreground/70">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input id="report-q" className="h-9 pl-9" placeholder="Producto o SKU…" value={qDraft} onChange={(event) => setQDraft(event.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyWithStock} onChange={(event) => setOnlyWithStock(event.target.checked)} />
            Solo con stock
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={detail} onChange={(event) => setDetail(event.target.checked)} />
            Ver físico y reservado por almacén
          </label>
        </div>
      </div>

      {dateError ? <p role="alert" className="text-sm text-destructive">{dateError}</p> : null}
      {exportError ? <p role="alert" className="text-sm text-destructive">{exportError}</p> : null}
      {report.error ? (
        <div role="alert" className="rounded border border-destructive p-4 text-sm">
          No se pudo cargar el reporte. {report.error instanceof Error ? report.error.message : ""}{" "}
          <Button variant="outline" size="sm" onClick={() => { void report.refetch(); void valuation.refetch(); }}>Reintentar</Button>
        </div>
      ) : null}

      {unavailable ? <UnavailableNotice message={unavailable.message} cutoffAt={unavailable.cutoffAt} /> : null}

      {valuation.data && valuation.data.available ? <ValuationCard valuation={valuation.data} /> : null}

      {data ? (
        <>
          <p className="text-xs text-muted-foreground">{sourceText(data)}</p>
          <div className="overflow-x-auto rounded-md border bg-card shadow-sm">
            <Table aria-label="Stock por variante y almacén">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Categoría</TableHead>
                  {columns.map((warehouse) => (
                    <TableHead key={warehouse.id} className="text-center">
                      {warehouse.name}
                      {detail ? <div className="text-[11px] font-normal text-muted-foreground">fís / res / disp</div> : null}
                    </TableHead>
                  ))}
                  <TableHead className={numericHead}>Físico</TableHead>
                  <TableHead className={numericHead}>Reservado</TableHead>
                  <TableHead className={numericHead}>Disponible</TableHead>
                  {live ? <TableHead className={numericHead}>Tránsito</TableHead> : null}
                  {live ? <TableHead className={numericHead}>Por recibir</TableHead> : null}
                  {showValues ? <TableHead className={numericHead}>Costo prom.</TableHead> : null}
                  {showValues ? <TableHead className={numericHead}>Valor</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow><TableCell colSpan={totalCols} className="h-24 text-center italic text-muted-foreground">No hay variantes con estos filtros.</TableCell></TableRow>
                ) : (
                  data.items.map((item) => (
                    <TableRow key={item.variantId}>
                      <TableCell className="text-sm">{reportVariantLabel(item)}</TableCell>
                      <TableCell className="font-mono text-xs">{reportSku(item)}</TableCell>
                      <TableCell className="text-sm">{item.brandName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{item.categoryName || <span className="text-muted-foreground">—</span>}</TableCell>
                      {columns.map((warehouse) => {
                        const cell = cellFor(item, warehouse.id);
                        return (
                          <TableCell key={warehouse.id} className="text-center tabular-nums">
                            {!cell ? <span className="text-muted-foreground">—</span>
                              : detail ? <span>{cell.physical} / {cell.reserved} / <b>{cell.available}</b></span>
                              : <b className={cn(cell.available <= 0 && cell.physical + cell.reserved > 0 && "text-red-600")}>{cell.available}</b>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums">{item.physical}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.reserved}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{item.available}</TableCell>
                      {live ? <TableCell className="text-right tabular-nums">{item.inTransit ?? 0}</TableCell> : null}
                      {live ? <TableCell className="text-right tabular-nums">{item.pendingReturn ?? 0}</TableCell> : null}
                      {showValues ? <TableCell className="text-right tabular-nums">{formatMoney(item.averageCost ?? null, 4)}</TableCell> : null}
                      {showValues ? <TableCell className="text-right tabular-nums">{formatMoney(item.value ?? null)}</TableCell> : null}
                    </TableRow>
                  ))
                )}
                {data.items.length > 0 ? (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={4}>Total · {data.totals.variants} variantes</TableCell>
                    {columns.map((warehouse) => <TableCell key={warehouse.id} />)}
                    <TableCell className="text-right tabular-nums">{data.totals.physical}</TableCell>
                    <TableCell className="text-right tabular-nums">{data.totals.reserved}</TableCell>
                    <TableCell className="text-right tabular-nums">{data.totals.available}</TableCell>
                    {live ? <TableCell /> : null}
                    {live ? <TableCell /> : null}
                    {showValues ? <TableCell /> : null}
                    {showValues ? <TableCell className="text-right tabular-nums">{formatMoney(data.totals.value ?? null)}</TableCell> : null}
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {!canSeeCosts ? <p className="text-xs text-muted-foreground">El costo y el valor ({MASK}) solo los ven el Administrador y Operaciones.</p> : null}
          {data.total > PAGE_SIZE ? (
            <Pagination currentPage={page} totalPages={Math.ceil(data.total / PAGE_SIZE)} totalItems={data.total} itemsPerPage={PAGE_SIZE} onPageChange={setPage} itemName="variantes" />
          ) : null}
        </>
      ) : report.isFetching ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando reporte…</p>
      ) : null}
    </div>
  );
}
