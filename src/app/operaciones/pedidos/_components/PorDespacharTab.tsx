"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Eye,
  MessageSquare,
  StickyNote,
  UserPen,
  DollarSign,
  PackagePlus,
  PlusCircle,
  Printer,
  MessageCircle,
  Copy,
  FileSpreadsheet,
  Truck,
  Loader2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ListChecks,
} from "lucide-react";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import { OPS_PERMISSIONS } from "@/config/operationsPermissions";
import {
  ITEMS_PER_PAGE,
  PedidosActions,
  Sale,
  SaleSource,
  computeBulkAvailableStatuses,
  formatProductsShort,
  money,
  saleDayKey,
  saleSource,
} from "./types";
import { StatusPill, StockIssueIcon } from "./shared";

/**
 * Pestaña "Por Despachar" — cockpit diario. Junta 3 fuentes en una sola
 * lista (preparados listos + reprogramados a ese día + vendidos con esa
 * fecha de entrega) y las muestra por día con la barra de fecha + pronóstico
 * del mockup — no solo "todo lo confirmado sin importar cuándo sale".
 */

const SOURCE_LABEL: Record<SaleSource, string> = {
  listos: "📦 Preparado listo",
  reprogramado: "🔁 Reprogramado hoy",
  vendido: "🛍️ Entrega hoy",
};

const SOURCE_BADGE_CLASS: Record<SaleSource, string> = {
  listos: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  reprogramado: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  vendido: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
};

const COLUMNS_STORAGE_KEY = "powip-operaciones-pedidos-columnas";

interface ColumnPrefs {
  guia: boolean;
  courier: boolean;
  vendedor: boolean;
}

const DEFAULT_COLUMNS: ColumnPrefs = { guia: true, courier: true, vendedor: true };

function loadColumnPrefs(): ColumnPrefs {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    return raw ? { ...DEFAULT_COLUMNS, ...JSON.parse(raw) } : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftKey(key: string, days: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function labelForDay(key: string): string {
  const d = new Date(key + "T00:00:00");
  const today = todayKey();
  const tomorrow = shiftKey(today, 1);
  const weekday = d.toLocaleDateString("es-PE", { weekday: "long" });
  const short = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  if (key === today) return `Hoy · ${weekday} ${short}`;
  if (key === tomorrow) return `Mañana · ${weekday} ${short}`;
  return `${weekday} ${short}`;
}

export function PorDespacharTab({
  sales,
  actions,
  initialSearch,
  initialQf,
}: {
  sales: Sale[];
  actions: PedidosActions;
  initialSearch?: string;
  initialQf?: string;
}) {
  const [filters, setFilters] = useState<SalesFilters>({
    ...emptySalesFilters,
    search: initialSearch ?? "",
  });
  const [qf, setQf] = useState(initialQf === "listos-escanear" ? "listos-escanear" : "");
  const [sourceFilter, setSourceFilter] = useState<SaleSource | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [dayKey, setDayKey] = useState(todayKey());
  const [columns, setColumns] = useState<ColumnPrefs>(DEFAULT_COLUMNS);

  useEffect(() => setColumns(loadColumnPrefs()), []);

  const setColumn = (key: keyof ColumnPrefs, value: boolean) => {
    setColumns((prev) => {
      const next = { ...prev, [key]: value };
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Pronóstico de los próximos 6 días (para la barra de fecha).
  const forecast = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sales) counts.set(saleDayKey(s), (counts.get(saleDayKey(s)) ?? 0) + 1);
    return Array.from({ length: 6 }, (_, i) => {
      const key = shiftKey(todayKey(), i);
      return { key, count: counts.get(key) ?? 0 };
    });
  }, [sales]);

  const salesOfDay = useMemo(() => sales.filter((s) => saleDayKey(s) === dayKey), [sales, dayKey]);

  const sourceCounts = useMemo(() => {
    const counts: Record<SaleSource, number> = { listos: 0, reprogramado: 0, vendido: 0 };
    for (const s of salesOfDay) counts[saleSource(s)]++;
    return counts;
  }, [salesOfDay]);

  const byQf = useMemo(() => {
    let list = salesOfDay;
    if (qf === "listos-escanear") list = list.filter((s) => !!s.guideNumber);
    if (sourceFilter) list = list.filter((s) => saleSource(s) === sourceFilter);
    return list;
  }, [salesOfDay, qf, sourceFilter]);

  const filtered = useMemo(() => applyFilters(byQf, filters), [byQf, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const allSelected = paged.every((s) => prev.has(s.id));
      const next = new Set(prev);
      paged.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  };

  const selectedSales = filtered.filter((s) => selectedIds.has(s.id));
  const bulkStatuses = useMemo(() => computeBulkAvailableStatuses(selectedSales), [selectedSales]);
  const canDispatch = actions.can(OPS_PERMISSIONS.DISPATCH);
  const canExport = actions.can(OPS_PERMISSIONS.EXPORT);
  const canChangeStatus = actions.can(OPS_PERMISSIONS.CHANGE_STATUS_MANUAL);

  const eligibleForGuide = selectedSales.filter(
    (s) => !s.guideNumber && s.deliveryType.toUpperCase() === "DOMICILIO",
  );
  const eligibleForCourier = selectedSales.filter((s) => s.status === "ASIGNADO_A_GUIA" && !s.courier);

  const handlePickingExport = () => {
    const bySku = new Map<string, { sku: string; producto: string; cantidad: number; pedidos: Set<string> }>();
    for (const s of filtered) {
      for (const it of s.items) {
        const key = it.sku || it.productName;
        if (!bySku.has(key)) bySku.set(key, { sku: it.sku, producto: it.productName, cantidad: 0, pedidos: new Set() });
        const row = bySku.get(key)!;
        row.cantidad += it.quantity;
        row.pedidos.add(s.orderNumber);
      }
    }
    const rows = Array.from(bySku.values()).map((r) => ({
      SKU: r.sku || "—",
      Producto: r.producto,
      "Cant. total": r.cantidad,
      "N° pedidos": r.pedidos.size,
      Pedidos: Array.from(r.pedidos).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Picking");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `picking_${dayKey}.xlsx`);
  };

  const visibleColCount = 8 + (columns.guia ? 1 : 0) + (columns.courier ? 1 : 0) + (columns.vendedor ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Barra de día + pronóstico */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setDayKey((k) => shiftKey(k, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Despacho de</div>
            <b className="text-sm capitalize">{labelForDay(dayKey)}</b>
          </div>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setDayKey((k) => shiftKey(k, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pronóstico:</span>
          {forecast.map((f) => (
            <button
              key={f.key}
              onClick={() => setDayKey(f.key)}
              className={`flex flex-col items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold ${
                f.key === dayKey ? "border-teal-400 bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" : "text-muted-foreground"
              }`}
            >
              {new Date(f.key + "T00:00:00").toLocaleDateString("es-PE", { weekday: "short" })}
              <span className="text-sm">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Sale {dayKey === todayKey() ? "hoy" : "ese día"} ({salesOfDay.length}):</span>
        <button
          onClick={() => {
            setSourceFilter("");
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            sourceFilter === "" ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
        >
          Todo el día ({salesOfDay.length})
        </button>
        {(Object.keys(SOURCE_LABEL) as SaleSource[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSourceFilter(s);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              sourceFilter === s ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {SOURCE_LABEL[s]} ({sourceCounts[s]})
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          onClick={() => {
            setQf(qf === "listos-escanear" ? "" : "listos-escanear");
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            qf === "listos-escanear" ? "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
        >
          🔫 Listos para escanear ({salesOfDay.filter((s) => !!s.guideNumber).length})
        </button>
      </div>

      <SalesTableFilters
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        showZoneFilter
        showGuideFilter
        showCourierFilter
        availableCouriers={actions.apiCouriers}
      />

      {selectedSales.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {selectedSales.length} seleccionados
          </span>
          {canDispatch && (
            <>
              <Button
                size="sm"
                className="h-8 gap-1 bg-violet-600 text-xs text-white hover:bg-violet-700"
                disabled={eligibleForGuide.length === 0}
                onClick={() => actions.onOpenCreateGuide(eligibleForGuide)}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Generar guía ({eligibleForGuide.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={eligibleForGuide.length === 0}
                onClick={() => actions.onOpenAddToGuide(eligibleForGuide)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Agregar a guía existente
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={eligibleForCourier.length === 0}
                onClick={() => actions.onAssignCourierBulk(eligibleForCourier)}
              >
                <Truck className="h-3.5 w-3.5" />
                Asignar courier ({eligibleForCourier.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={actions.isBulkLoading}
                onClick={() => actions.onBulkPrint(selectedSales)}
              >
                {actions.isBulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                Imprimir etiquetas
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => actions.onBulkWhatsApp(selectedSales)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp masivo
          </Button>
          {canChangeStatus && (
            <BulkStatusSelect
              selectedCount={selectedSales.length}
              availableStatuses={bulkStatuses}
              onStatusChange={(status) => actions.onBulkStatusChange(Array.from(selectedIds), status)}
              isLoading={actions.isBulkLoading}
            />
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onCopySelected(selectedSales)}>
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
          {canExport && (
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => actions.onExportExcel(selectedSales, "por_despachar")}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Exportar Excel
            </Button>
          )}
        </div>
      )}

      {/* Panel con título, como en el mockup */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold capitalize">
              Sale {labelForDay(dayKey)}
              <span className="rounded-full border border-teal-200 bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300">
                {salesOfDay.length} pedidos
              </span>
            </h3>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Todo lo que tiene entrega comprometida para este día, sin importar de qué fuente venga. Empaca,
              agrupa en guía y entrega al courier.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Columnas
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <p className="mb-2 text-xs font-semibold">Mostrar columnas</p>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox checked={columns.guia} onCheckedChange={(v) => setColumn("guia", !!v)} /> Guía
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={columns.courier} onCheckedChange={(v) => setColumn("courier", !!v)} /> Courier
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={columns.vendedor} onCheckedChange={(v) => setColumn("vendedor", !!v)} /> Vendedor
                  </label>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePickingExport}>
              <ListChecks className="h-3.5 w-3.5" />
              Lista de picking
            </Button>
            {canDispatch && (
              <Button
                size="sm"
                className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                disabled={eligibleForGuide.length === 0}
                onClick={() => actions.onOpenCreateGuide(eligibleForGuide.length > 0 ? eligibleForGuide : filtered)}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Generar Guía
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={paged.length > 0 && paged.every((s) => selectedIds.has(s.id))} onCheckedChange={toggleAllPage} />
                </TableHead>
                <TableHead>N° Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Distrito</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Total / Saldo</TableHead>
                <TableHead>Estado</TableHead>
                {columns.guia && <TableHead>Guía</TableHead>}
                {columns.courier && <TableHead>Courier</TableHead>}
                {columns.vendedor && <TableHead>Vendedor</TableHead>}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColCount} className="py-8 text-center text-sm text-muted-foreground">
                    Sin pedidos por despachar ese día
                  </TableCell>
                </TableRow>
              )}
              {paged.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(sale.id)} onCheckedChange={() => toggle(sale.id)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <StockIssueIcon show={sale.hasStockIssue} />
                      {sale.orderNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{sale.clientName}</div>
                    <div className="text-xs text-muted-foreground">{sale.phoneNumber}</div>
                  </TableCell>
                  <TableCell className="text-sm">{sale.district || "—"}</TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal text-xs text-muted-foreground">
                    {formatProductsShort(sale.items)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SOURCE_BADGE_CLASS[saleSource(sale)]}`}>
                      {SOURCE_LABEL[saleSource(sale)]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {money(sale.total)}
                    {sale.pendingPayment > 0 && (
                      <div className="text-xs font-semibold text-red-600">Saldo {money(sale.pendingPayment)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={sale.status} />
                  </TableCell>
                  {columns.guia && (
                    <TableCell className="text-sm">
                      {sale.guideNumber ? (
                        <button className="font-semibold text-violet-600 underline hover:text-violet-700" onClick={() => actions.onOpenGuide(sale)}>
                          {sale.guideNumber}
                        </button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  {columns.courier && <TableCell className="text-sm">{sale.courier || "—"}</TableCell>}
                  {columns.vendedor && (
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        {sale.sellerName || "—"}
                        {actions.can(OPS_PERMISSIONS.REASSIGN_SELLER) && (
                          <button title="Reasignar vendedor" onClick={() => actions.onReassignSeller(sale)} className="text-muted-foreground hover:text-foreground">
                            <UserPen className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver pedido" onClick={() => actions.onView(sale)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Registrar cobro" onClick={() => actions.onOpenPayment(sale)}>
                        <DollarSign className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="WhatsApp" onClick={() => actions.onWhatsApp(sale)}>
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Comentarios" onClick={() => actions.onOpenComments(sale)}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Observaciones" onClick={() => actions.onOpenNotes(sale)}>
                        <StickyNote className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar pedido" onClick={() => actions.onEdit(sale)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border-t p-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPage}
            itemName="pedidos"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            Mostrando {filtered.length} de {salesOfDay.length} pedidos del día ·{" "}
            <b className="text-foreground">
              {sourceCounts.listos} listos + {sourceCounts.reprogramado} reprogramados + {sourceCounts.vendido} con entrega ese día
            </b>{" "}
            · {money(filtered.reduce((sum, s) => sum + s.pendingPayment, 0))} por cobrar
          </span>
          <span>
            Se armarán {new Set(filtered.map((s) => s.courier || s.zone || "sin asignar")).size} guía(s) por courier/zona
          </span>
        </div>
      </div>
    </div>
  );
}
