import { describeMovement, formatPeruDateTime } from "@/components/inventory/movementLabels";
import { kardexLotsOf, kardexLotsText } from "@/lib/lots";
import type { PdfDocSpec } from "@/lib/pdf/document";
import type { KardexRow } from "@/services/inventoryReportsService";
import { buildReportWorkbook, COST_FMT, MONEY_FMT, QTY_FMT, type SheetColumn } from "./excel";
import { reportSku, reportVariantLabel } from "./stockReport";
import { kardexTypeLabel } from "./kardexTypes";
import { formatYmd } from "./periods";

// FEAT-24 H10 — kardex (Inventario › Movimientos) a Excel y PDF, con los mismos
// filtros de la pantalla. Funciones puras.

export interface KardexFilterState {
  variantLabel: string;
  inventoryName: string;
  type: string;
  from: string;
  to: string;
  document: string;
}

export function kardexFilterRows(filters: KardexFilterState): Array<[string, string]> {
  return [
    ["Producto", filters.variantLabel || "Todos"],
    ["Almacén", filters.inventoryName || "Todos los almacenes"],
    ["Tipo", filters.type ? kardexTypeLabel(filters.type) : "Todos los tipos"],
    ["Desde", filters.from ? formatYmd(filters.from) : "—"],
    ["Hasta", filters.to ? formatYmd(filters.to) : "—"],
    ["Documento", filters.document.trim() || "—"],
  ];
}

/** Referencia legible: el documento, el número de pedido o «Pedido» (nunca un UUID). */
export function kardexReference(row: KardexRow, orderNumbers: Record<string, string> = {}): string {
  const view = describeMovement(row);
  return view.documentNumber ?? (view.orderId ? orderNumbers[view.orderId] ?? "Pedido" : "");
}

const num = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export function kardexWorkbook(
  rows: KardexRow[],
  options: { filters: Array<[string, string]>; canSeeCosts: boolean; orderNumbers?: Record<string, string>; generatedBy?: string; truncated?: boolean; now?: Date },
) {
  const costs = options.canSeeCosts && rows.some((row) => "unitCost" in row);
  // FEAT-24 H5-L: columna «Lotes» si algún movimiento tiene lotes.
  const lots = rows.some((row) => kardexLotsOf(row) !== null);
  const columns: SheetColumn[] = [
    { header: "Fecha y hora", key: "date", width: 18 },
    { header: "Tipo", key: "type", width: 24 },
    { header: "Detalle", key: "detail", width: 30 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Producto", key: "product", width: 36 },
    { header: "Almacén", key: "warehouse", width: 20 },
    ...(lots ? [{ header: "Lotes", key: "lots", width: 28 }] : []),
    { header: "Físico", key: "physical", numFmt: QTY_FMT },
    { header: "Saldo físico", key: "physicalAfter", numFmt: QTY_FMT },
    { header: "Reservado", key: "reserved", numFmt: QTY_FMT },
    { header: "Saldo reservado", key: "reservedAfter", numFmt: QTY_FMT },
    { header: "En camino", key: "transit", numFmt: QTY_FMT },
    ...(costs
      ? [
          { header: "Costo unit.", key: "unitCost", numFmt: COST_FMT },
          { header: "Valor", key: "value", numFmt: MONEY_FMT },
          { header: "Costo prom. después", key: "averageCostAfter", numFmt: COST_FMT },
        ]
      : []),
    { header: "Referencia", key: "reference", width: 18 },
    { header: "Usuario", key: "user", width: 24 },
  ];
  const filters = options.truncated ? [...options.filters, ["Aviso", "Hay más de 10.000 movimientos: se exportaron los 10.000 más nuevos."] as [string, string]] : options.filters;
  return buildReportWorkbook({
    title: "Movimientos de inventario (kardex)",
    filters,
    generatedBy: options.generatedBy,
    generatedAt: options.now,
    sheets: [
      {
        name: "Movimientos",
        columns,
        rows: rows.map((row) => {
          const view = describeMovement(row);
          return {
            date: formatPeruDateTime(row.createdAt),
            type: view.label,
            detail: view.detail ?? "",
            sku: reportSku(row),
            product: reportVariantLabel(row),
            warehouse: row.inventoryName ?? "",
            lots: kardexLotsText(kardexLotsOf(row)),
            physical: view.physicalDelta,
            physicalAfter: view.physicalAfter,
            reserved: view.reservedDelta,
            reservedAfter: view.reservedAfter,
            transit: num(row.transitDelta) || null,
            unitCost: num(row.unitCost),
            value: num(row.value),
            averageCostAfter: num(row.averageCostAfter),
            reference: kardexReference(row, options.orderNumbers),
            user: row.userName || row.userEmail || "Sistema",
          };
        }),
      },
    ],
  });
}

const signed = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value}`);

export function kardexPdfSpec(rows: KardexRow[], options: { filters: Array<[string, string]>; orderNumbers?: Record<string, string>; today: string }): PdfDocSpec {
  return {
    title: "Movimientos de inventario",
    number: formatYmd(options.today),
    meta: options.filters,
    tables: [
      {
        head: ["Fecha", "Tipo", "SKU", "Producto", "Almacén", "Físico", "Reservado", "Referencia", "Usuario"],
        rows: rows.map((row) => {
          const view = describeMovement(row);
          return [
            formatPeruDateTime(row.createdAt),
            view.label,
            reportSku(row),
            // FEAT-24 H5-L: los lotes van debajo del producto.
            [reportVariantLabel(row), kardexLotsText(kardexLotsOf(row))].filter(Boolean).join("\n"),
            row.inventoryName ?? "",
            signed(view.physicalDelta),
            signed(view.reservedDelta),
            kardexReference(row, options.orderNumbers),
            row.userName || row.userEmail || "Sistema",
          ];
        }),
        align: ["left", "left", "left", "left", "left", "right", "right", "left", "left"],
      },
    ],
    landscape: true,
    fileName: `movimientos-${options.today}`,
  };
}
