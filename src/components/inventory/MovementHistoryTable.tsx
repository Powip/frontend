"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { BusinessInventory } from "@/services/inventoryCatalogService";
import { getKardex, type KardexFilters } from "@/services/inventoryReportsService";
import { resolveOrderNumbers } from "@/services/orderNumbersService";
import { useReconciliationVariantSearch } from "@/hooks/useReconciliationVariantSearch";
import { usePdfDownload, useReportAuthor } from "@/hooks/usePdfDownload";
import { canSeeProductCosts } from "@/config/permissions.config";
import { formatMoney, todayInLima } from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { KARDEX_TYPE_OPTIONS } from "@/lib/reports/kardexTypes";
import { kardexFilterRows, kardexPdfSpec, kardexReference, kardexWorkbook } from "@/lib/reports/kardex";
import { reportSku, reportVariantLabel } from "@/lib/reports/stockReport";
import { downloadWorkbook } from "@/lib/reports/excel";
import { SELECT_CLASS } from "@/components/compras/PurchaseBits";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { describeMovement, formatPeruDateTime } from "./movementLabels";

// FEAT-24 H10 — Inventario › Movimientos y el Historial de la ficha: el kardex
// de la fachada (`GET /inventory-reports/kardex`, JWT, empresa del token). Los
// filtros van a la API y la paginación es del servidor. Reemplaza la lectura
// sin guarda de `/inventory-movement/company/:companyId`.

const PAGE_SIZE = 25;
const BASE_COLUMNS = ["Fecha y hora", "Tipo", "Producto / SKU", "Almacén", "Físico", "Reservado", "Referencia", "Usuario", "Motivo"];
const VALUE_COLUMNS = ["Costo unit.", "Valor", "Costo prom."];
/** Lo que parece un número de documento va al filtro exacto «Documento», no al buscador de productos. */
const DOCUMENT_LIKE = /^(ORD|COM|TRA|OC|REC|DEV)-\S+$/i;

export interface KardexVariantOption {
  id: string;
  label: string;
}

interface MovementHistoryTableProps {
  companyId: string | undefined;
  scope?: "business" | "store";
  inventories?: BusinessInventory[];
  scopeReady?: boolean;
  scopeError?: Error | null;
  onRetryScope?: () => void;
  /** Texto inicial: un documento (ORD-, OC-…) va a «Documento»; otra cosa, al buscador de productos. */
  initialSearch?: string;
  /** Variante con la que arranca (desde Stock, «Ver movimientos»); `initialSearch` es su nombre. */
  initialVariantId?: string;
  /** Ficha del producto: sus variantes (el kardex se lee de a una; arranca en la primera). */
  variants?: KardexVariantOption[];
  title?: string;
  description?: string;
}

const NO_INVENTORIES: BusinessInventory[] = [];
const signed = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value}`);

function initialVariant(variants: KardexVariantOption[] | undefined, initialVariantId: string | undefined, initialSearch: string): KardexVariantOption | null {
  if (variants?.length) return variants[0];
  if (initialVariantId) return { id: initialVariantId, label: initialSearch || "Variante elegida" };
  return null;
}

export function MovementHistoryTable({
  companyId,
  scope = "business",
  inventories = NO_INVENTORIES,
  scopeReady = true,
  scopeError,
  onRetryScope,
  initialSearch = "",
  initialVariantId,
  variants,
  title,
  description,
}: MovementHistoryTableProps) {
  const { auth } = useAuth();
  const canSeeCosts = canSeeProductCosts(auth?.user);
  const author = useReportAuthor();
  const downloadPdf = usePdfDownload();
  const startsWithDocument = !initialVariantId && DOCUMENT_LIKE.test(initialSearch.trim());

  const [variant, setVariant] = useState<KardexVariantOption | null>(() => initialVariant(variants, initialVariantId, initialSearch));
  const [variantText, setVariantText] = useState(initialVariantId || startsWithDocument || variants?.length ? "" : initialSearch);
  const [documentDraft, setDocumentDraft] = useState(startsWithDocument ? initialSearch.trim() : "");
  const [documentFilter, setDocumentFilter] = useState(startsWithDocument ? initialSearch.trim() : "");
  const [type, setType] = useState("");
  const [inventoryChoice, setInventoryChoice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [valued, setValued] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // En una tienda se lee un almacén por vez (la fachada filtra por uno): el elegido o el primero.
  const inventoryId = scope === "store"
    ? (inventories.some((inv) => inv.id === inventoryChoice) ? inventoryChoice : inventories[0]?.id ?? "")
    : inventoryChoice;
  const inventoryName = (id: string) => inventories.find((inv) => inv.id === id)?.name ?? "";
  const rangeError = from && to && from > to ? "La fecha «Desde» no puede ser posterior a «Hasta»." : null;
  const showValues = canSeeCosts && valued;

  const filters: KardexFilters = useMemo(
    () => ({
      variantId: variant?.id,
      inventoryId: inventoryId || undefined,
      types: type ? [type] : undefined,
      from: from || undefined,
      to: to || undefined,
      document: documentFilter || undefined,
    }),
    [variant?.id, inventoryId, type, from, to, documentFilter],
  );
  useEffect(() => setPage(1), [filters]);

  const sessionReady = Boolean(companyId && auth?.company?.id === companyId && auth?.accessToken && auth?.user?.id);
  const scopeOk = scope === "business" || (scopeReady && Boolean(inventoryId));
  const query = useQuery({
    queryKey: ["inventory-kardex", companyId, auth?.user?.id, filters, page],
    queryFn: ({ signal }) => getKardex({ ...filters, page, limit: PAGE_SIZE }, signal),
    enabled: sessionReady && scopeOk && !scopeError && !rangeError,
    retry: false,
  });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  const orderIds = useMemo(
    () => [...new Set(rows.map((row) => describeMovement(row).orderId).filter((id): id is string => !!id))].sort(),
    [rows],
  );
  const orderNumbers = useQuery({
    queryKey: ["inventory-movement-order-numbers", companyId, orderIds],
    queryFn: () => resolveOrderNumbers(orderIds),
    enabled: orderIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const search = useReconciliationVariantSearch(variant ? "" : variantText);
  const pickVariant = (option: KardexVariantOption) => {
    setVariant(option);
    setVariantText("");
  };
  const clearVariant = () => {
    setVariant(null);
    setVariantText("");
  };
  const clearFilters = () => {
    if (!variants?.length) clearVariant();
    setDocumentDraft("");
    setDocumentFilter("");
    setType("");
    setInventoryChoice("");
    setFrom("");
    setTo("");
  };

  const exportAll = async (kind: "excel" | "pdf") => {
    setExporting(kind);
    setExportError(null);
    try {
      const all = await getKardex({ ...filters, all: true });
      const ids = [...new Set(all.items.map((row) => describeMovement(row).orderId).filter((id): id is string => !!id))];
      const numbers = ids.length ? await resolveOrderNumbers(ids).catch(() => ({})) : {};
      const filterRows = kardexFilterRows({ variantLabel: variant?.label ?? "", inventoryName: inventoryName(inventoryId), type, from, to, document: documentFilter });
      const today = todayInLima();
      if (kind === "excel") {
        await downloadWorkbook(kardexWorkbook(all.items, { filters: filterRows, canSeeCosts, orderNumbers: numbers, generatedBy: author, truncated: all.truncated }), `movimientos-${today}`);
      } else {
        await downloadPdf(kardexPdfSpec(all.items, { filters: filterRows, orderNumbers: numbers, today }));
      }
    } catch (error) {
      setExportError(`No se pudo descargar el ${kind === "excel" ? "Excel" : "PDF"}. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      setExporting(null);
    }
  };

  const error = scopeError || query.error;
  const isLoading = !error && !rangeError && (query.isFetching || (scope === "store" && !scopeReady));
  const columns = [...BASE_COLUMNS.slice(0, 6), ...(showValues ? VALUE_COLUMNS : []), ...BASE_COLUMNS.slice(6)];
  const storeWithoutWarehouses = scope === "store" && scopeReady && inventories.length === 0;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">{title ?? "Movimientos (kardex)"}</h3>
          <p className="text-sm text-muted-foreground">
            {description ?? (scope === "business" ? "Entradas, salidas, reservas y traslados de todos tus almacenes, con su saldo." : "Movimientos del almacén elegido de esta tienda, con su saldo.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || !query.isSuccess || total === 0} onClick={() => void exportAll("excel")}>
            <Download className="mr-2 h-4 w-4" />
            {exporting === "excel" ? "Preparando…" : "Descargar Excel"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!!exporting || !query.isSuccess || total === 0} onClick={() => void exportAll("pdf")}>
            <FileText className="mr-2 h-4 w-4" />
            {exporting === "pdf" ? "Preparando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>

      <form
        className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border/50 bg-muted/40 p-4 md:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setDocumentFilter(documentDraft.trim());
        }}
      >
        <div className="relative flex flex-col space-y-1.5 lg:col-span-2">
          <Label htmlFor="kardex-variant" className="text-xs font-semibold uppercase text-muted-foreground/70">Producto</Label>
          {variants?.length ? (
            <select id="kardex-variant" className={SELECT_CLASS} value={variant?.id ?? ""} onChange={(event) => setVariant(variants.find((option) => option.id === event.target.value) ?? null)}>
              {variants.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          ) : variant ? (
            <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm">
              <span className="truncate" title={variant.label}>{variant.label}</span>
              <button type="button" aria-label="Quitar producto" className="text-muted-foreground hover:text-foreground" onClick={clearVariant}><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="kardex-variant" className="h-9 pl-9" placeholder="Busca un producto o SKU…" value={variantText} onChange={(event) => setVariantText(event.target.value)} autoComplete="off" />
              </div>
              {search.isSearchable ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-md" role="listbox" aria-label="Productos encontrados">
                  {search.isLoading ? <p className="p-2 text-xs text-muted-foreground">Buscando…</p>
                    : search.isError ? <p className="p-2 text-xs text-destructive">No se pudo buscar. Intenta de nuevo.</p>
                    : search.results.length === 0 ? <p className="p-2 text-xs text-muted-foreground">Sin coincidencias.</p>
                    : search.results.map((result) => {
                      const attributes = formatVariantLabel(result.attribute_values);
                      const label = [result.product_name, attributes].filter(Boolean).join(" · ");
                      const sku = result.company_sku || result.sku;
                      return (
                        <button key={result.variant_id} type="button" role="option" aria-selected={false} className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => pickVariant({ id: result.variant_id, label: `${label}${sku ? ` (${sku})` : ""}` })}>
                          <span>{label}</span>
                          {sku ? <span className="font-mono text-[11px] text-muted-foreground">{sku}</span> : null}
                        </button>
                      );
                    })}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="kardex-document" className="text-xs font-semibold uppercase text-muted-foreground/70">Documento</Label>
          <Input id="kardex-document" className="h-9" placeholder="ORD-, OC-, REC-, TRA-…" value={documentDraft} onChange={(event) => setDocumentDraft(event.target.value)} onBlur={() => setDocumentFilter(documentDraft.trim())} />
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="kardex-type" className="text-xs font-semibold uppercase text-muted-foreground/70">Tipo</Label>
          <select id="kardex-type" className={SELECT_CLASS} value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos los tipos</option>
            {KARDEX_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="kardex-warehouse" className="text-xs font-semibold uppercase text-muted-foreground/70">Almacén</Label>
          <select id="kardex-warehouse" className={SELECT_CLASS} value={inventoryId} onChange={(event) => setInventoryChoice(event.target.value)} disabled={inventories.length === 0 || (scope === "store" && inventories.length === 1)}>
            {scope === "business" ? <option value="">Todos mis almacenes</option> : null}
            {inventories.map((inv) => <option key={inv.id} value={inv.id}>{inv.name}{scope === "business" && inv.storeName ? ` · ${inv.storeName}` : ""}</option>)}
          </select>
        </div>

        <div className="flex flex-col space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-muted-foreground/70">Fechas</Label>
          <div className="flex gap-2">
            <Input type="date" aria-label="Desde" title="Desde" className="h-9 text-xs" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" aria-label="Hasta" title="Hasta" className="h-9 text-xs" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:col-span-6">
          <Button type="submit" size="sm" className="h-9 px-4">Filtrar</Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />Limpiar filtros
          </Button>
          {canSeeCosts ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={valued} onChange={(event) => setValued(event.target.checked)} />
              Kardex valorizado
            </label>
          ) : null}
        </div>
      </form>

      {rangeError ? <p role="alert" className="text-sm text-destructive">{rangeError}</p> : null}
      {exportError ? <p role="alert" className="text-sm text-destructive">{exportError}</p> : null}
      {storeWithoutWarehouses ? <p className="text-sm text-muted-foreground">Esta tienda todavía no tiene almacenes.</p> : null}
      {error ? (
        <div role="alert" className="rounded border border-destructive p-4">
          No se pudo cargar el historial. {error instanceof Error ? error.message : "Verifica el alcance y la sesión."}{" "}
          <Button variant="outline" onClick={() => { if (scopeError) onRetryScope?.(); else void query.refetch(); }}>Reintentar</Button>
        </div>
      ) : null}

      <div className="flex min-h-[300px] flex-col overflow-hidden rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column) => (
                <TableHead key={column} className={cn(["Físico", "Reservado", ...VALUE_COLUMNS].includes(column) && "text-right", column === "Fecha y hora" && "w-[150px]")}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow><TableCell colSpan={columns.length}>Historial no disponible.</TableCell></TableRow>
            ) : isLoading ? (
              [...Array(8)].map((_, index) => (
                <TableRow key={index}>
                  {columns.map((column) => <TableCell key={column}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center italic text-muted-foreground">
                  No se encontraron movimientos con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const view = describeMovement(row);
                const reference = kardexReference(row, orderNumbers.data ?? {}) || "—";
                const transit = typeof row.transitDelta === "number" && row.transitDelta !== 0 ? row.transitDelta : null;
                return (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">{formatPeruDateTime(row.createdAt)}</TableCell>
                    <TableCell><Badge variant="secondary" className="max-w-[180px] whitespace-normal text-left">{view.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="line-clamp-1 max-w-[220px] text-sm font-semibold">{reportVariantLabel(row)}</span>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">{reportSku(row)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{row.inventoryName || inventoryName(row.inventoryId) || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("text-sm font-bold", view.physicalDelta !== null && (view.physicalDelta >= 0 ? "text-green-600" : "text-red-600"))}>{signed(view.physicalDelta)}</span>
                        {view.physicalAfter !== null ? <span className="text-[10px] font-normal text-muted-foreground">saldo {view.physicalAfter}</span> : null}
                        {transit !== null ? <span className="text-[10px] text-amber-700">en camino {signed(transit)}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-blue-700 dark:text-blue-400">{signed(view.reservedDelta)}</span>
                        {view.reservedAfter !== null ? <span className="text-[10px] text-muted-foreground">saldo {view.reservedAfter}</span> : null}
                      </div>
                    </TableCell>
                    {showValues ? (
                      <>
                        <TableCell className="text-right text-xs tabular-nums">{formatMoney("unitCost" in row ? row.unitCost ?? null : undefined, 4)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{formatMoney("value" in row ? row.value ?? null : undefined)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{formatMoney("averageCostAfter" in row ? row.averageCostAfter ?? null : undefined, 4)}</TableCell>
                      </>
                    ) : null}
                    <TableCell className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">{reference}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="max-w-[120px] truncate text-xs font-medium">{row.userName || row.userEmail || "Sistema"}</span>
                        {row.userName && row.userEmail ? <span className="max-w-[120px] truncate text-[9px] text-muted-foreground">{row.userEmail}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal break-words text-xs text-muted-foreground">{view.detail || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!error && !rangeError ? (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Total: <span className="font-medium">{total}</span> {total === 1 ? "movimiento" : "movimientos"}
          </div>
          {!isLoading && total > PAGE_SIZE ? (
            <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} totalItems={total} itemsPerPage={PAGE_SIZE} onPageChange={setPage} itemName="movimientos" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
