import { formatVariantLabel } from "@/lib/variantAttributes";
import { formatMoney } from "@/lib/purchaseOrders";
import type { PdfDocSpec } from "@/lib/pdf/document";
import type { ReportWarehouse, StockReportCell, StockReportData, StockReportItem, ValuationData } from "@/services/inventoryReportsService";
import { buildReportWorkbook, COST_FMT, MONEY_FMT, QTY_FMT, type SheetColumn, type SheetSpec } from "./excel";
import { formatYmd, periodLabel } from "./periods";

// FEAT-24 H10-D3 — Reporte general: variantes × almacenes a una fecha, con su
// Excel (Filtros, Resumen y Detalle por almacén) y su PDF. Funciones puras.

export interface StockReportFilterState {
  /** YYYY-MM-DD; vacío = hoy. */
  date: string;
  inventoryId: string;
  q: string;
  onlyWithStock: boolean;
}

/** «Polo básico · Talla: M». */
export function reportVariantLabel(item: { productName?: string | null; attributes?: Record<string, string> | null }): string {
  const attributes = formatVariantLabel(item.attributes);
  return [item.productName || "Variante fuera del catálogo", attributes].filter(Boolean).join(" · ");
}

/** SKU que se muestra: el de la empresa si lo tiene, si no el de POWIP. */
export const reportSku = (item: { companySku?: string | null; sku?: string | null }): string => item.companySku || item.sku || "—";

/** Celda de un almacén (vacía si la variante no tiene ítem ahí). */
export function cellFor(item: StockReportItem, inventoryId: string): StockReportCell | null {
  return item.warehouses.find((cell) => cell.inventoryId === inventoryId) ?? null;
}

/** Columnas de almacén: el elegido, o todos los del reporte. */
export function reportWarehouses(report: Pick<StockReportData, "warehouses">, inventoryId?: string): ReportWarehouse[] {
  const all = report.warehouses ?? [];
  return inventoryId ? all.filter((warehouse) => warehouse.id === inventoryId) : all;
}

/** ¿La API mandó costos? (sin permiso omite `value` de los totales). */
export const reportHasCosts = (report: Pick<StockReportData, "totals">): boolean => "value" in (report.totals ?? {});

/** De dónde sale el stock a esa fecha, en palabras. */
export function sourceText(report: Pick<StockReportData, "source" | "closePeriod" | "date">): string {
  if (report.source === "live") return "Stock de hoy";
  if (report.source === "close") return `Foto del cierre de ${periodLabel(report.closePeriod)}`;
  return report.closePeriod
    ? `Cierre de ${periodLabel(report.closePeriod)} más los movimientos hasta el ${formatYmd(report.date)}`
    : `Libro de stock al ${formatYmd(report.date)}`;
}

/** Filtros en palabras (Excel y PDF). */
export function stockReportFilterRows(filters: StockReportFilterState, warehouseName: (id: string) => string): Array<[string, string]> {
  return [
    ["Fecha", filters.date ? formatYmd(filters.date) : "Hoy"],
    ["Almacén", filters.inventoryId ? warehouseName(filters.inventoryId) : "Todos los almacenes"],
    ["Búsqueda", filters.q.trim() || "—"],
    ["Solo con stock", filters.onlyWithStock ? "Sí" : "No"],
  ];
}

const num = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export function stockReportWorkbook(
  report: StockReportData,
  options: { filters: Array<[string, string]>; canSeeCosts: boolean; inventoryId?: string; generatedBy?: string; now?: Date },
) {
  const warehouses = reportWarehouses(report, options.inventoryId);
  const costs = options.canSeeCosts && reportHasCosts(report);
  const live = report.source === "live";
  const summaryColumns: SheetColumn[] = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Producto", key: "product", width: 36 },
    { header: "Marca", key: "brand", width: 16 },
    { header: "Categoría", key: "category", width: 18 },
    ...warehouses.map((warehouse) => ({ header: `${warehouse.name} (disponible)`, key: `w:${warehouse.id}`, numFmt: QTY_FMT })),
    { header: "Físico", key: "physical", numFmt: QTY_FMT },
    { header: "Reservado", key: "reserved", numFmt: QTY_FMT },
    { header: "Disponible", key: "available", numFmt: QTY_FMT },
    ...(live
      ? [
          { header: "En camino", key: "inTransit", numFmt: QTY_FMT },
          { header: "Por recibir", key: "pendingReturn", numFmt: QTY_FMT },
        ]
      : []),
    ...(costs
      ? [
          { header: "Costo prom.", key: "averageCost", numFmt: COST_FMT },
          { header: "Valor", key: "value", numFmt: MONEY_FMT },
        ]
      : []),
  ];
  const summary: SheetSpec = {
    name: "Resumen",
    columns: summaryColumns,
    rows: report.items.map((item) => ({
      sku: reportSku(item),
      product: reportVariantLabel(item),
      brand: item.brandName ?? "",
      category: item.categoryName ?? "",
      ...Object.fromEntries(warehouses.map((warehouse) => [`w:${warehouse.id}`, cellFor(item, warehouse.id)?.available ?? null])),
      physical: item.physical,
      reserved: item.reserved,
      available: item.available,
      inTransit: num(item.inTransit),
      pendingReturn: num(item.pendingReturn),
      averageCost: num(item.averageCost),
      value: num(item.value),
    })),
  };
  const detail: SheetSpec = {
    name: "Detalle por almacén",
    columns: [
      { header: "Almacén", key: "warehouse", width: 22 },
      { header: "SKU", key: "sku", width: 18 },
      { header: "Producto", key: "product", width: 36 },
      { header: "Físico", key: "physical", numFmt: QTY_FMT },
      { header: "Reservado", key: "reserved", numFmt: QTY_FMT },
      { header: "Disponible", key: "available", numFmt: QTY_FMT },
      ...(live
        ? [
            { header: "En camino", key: "inTransit", numFmt: QTY_FMT },
            { header: "Por recibir", key: "pendingReturn", numFmt: QTY_FMT },
          ]
        : []),
      ...(costs ? [{ header: "Valor", key: "value", numFmt: MONEY_FMT }] : []),
    ],
    rows: report.items.flatMap((item) =>
      warehouses.flatMap((warehouse) => {
        const cell = cellFor(item, warehouse.id);
        if (!cell) return [];
        return [
          {
            warehouse: warehouse.name,
            sku: reportSku(item),
            product: reportVariantLabel(item),
            physical: cell.physical,
            reserved: cell.reserved,
            available: cell.available,
            inTransit: num(cell.inTransit),
            pendingReturn: num(cell.pendingReturn),
            value: num(cell.value),
          },
        ];
      }),
    ),
  };
  return buildReportWorkbook({
    title: `Reporte general de inventario · ${sourceText(report)}`,
    filters: options.filters,
    generatedBy: options.generatedBy,
    generatedAt: options.now,
    sheets: [summary, detail],
  });
}

export function stockReportPdfSpec(
  report: StockReportData,
  options: { filters: Array<[string, string]>; canSeeCosts: boolean; inventoryId?: string },
): PdfDocSpec {
  const warehouses = reportWarehouses(report, options.inventoryId);
  const costs = options.canSeeCosts && reportHasCosts(report);
  const live = report.source === "live";
  const head = [
    "SKU",
    "Producto",
    ...warehouses.map((warehouse) => warehouse.name),
    "Físico",
    "Reservado",
    "Disponible",
    ...(live ? ["En camino"] : []),
    ...(costs ? ["Costo prom.", "Valor"] : []),
  ];
  const rows = report.items.map((item) => [
    reportSku(item),
    reportVariantLabel(item),
    ...warehouses.map((warehouse) => String(cellFor(item, warehouse.id)?.available ?? "—")),
    String(item.physical),
    String(item.reserved),
    String(item.available),
    ...(live ? [String(item.inTransit ?? 0)] : []),
    ...(costs ? [formatMoney(item.averageCost, 4), formatMoney(item.value)] : []),
  ]);
  const numeric = head.length - 2;
  return {
    title: "Reporte general de inventario",
    number: formatYmd(report.date),
    date: formatYmd(report.date),
    meta: [...options.filters, ["Origen", sourceText(report)], ["Variantes", String(report.totals?.variants ?? report.items.length)]],
    tables: [{ head, rows, align: ["left", "left", ...Array(numeric).fill("right")] }],
    foot: [
      ["Físico", String(report.totals?.physical ?? 0)],
      ["Reservado", String(report.totals?.reserved ?? 0)],
      ...(costs ? ([["Sin costo", `${report.totals.withoutCost?.variants ?? 0} variantes`]] as Array<[string, string]>) : []),
      costs ? ["Valor del inventario", formatMoney(report.totals.value)] : ["Disponible", String(report.totals?.available ?? 0)],
    ],
    signatures: ["Elaborado por"],
    landscape: true,
    fileName: `reporte-general-${report.date}`,
  };
}

/** Valorizado por almacén, para la tarjeta del reporte. `value` ausente = sin permiso. */
export function valuationRows(valuation: ValuationData) {
  return valuation.warehouses.map((warehouse) => ({
    inventoryId: warehouse.inventoryId,
    name: warehouse.name,
    units: warehouse.units,
    value: "value" in warehouse ? warehouse.value ?? null : undefined,
    withoutCostItems: warehouse.withoutCost?.items ?? 0,
    withoutCostUnits: warehouse.withoutCost?.units ?? 0,
  }));
}
