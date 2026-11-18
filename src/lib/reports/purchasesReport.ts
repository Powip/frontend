import { formatMoney } from "@/lib/purchaseOrders";
import { formatVariantLabel } from "@/lib/variantAttributes";
import type { PdfDocSpec } from "@/lib/pdf/document";
import type { PurchasesReport } from "@/services/inventoryReportsService";
import { buildReportWorkbook, MONEY_FMT, QTY_FMT, COST_FMT } from "./excel";
import { formatYmd, periodLabel } from "./periods";

// FEAT-24 H10-D7 — reporte de compras (mockup vComRep): totales por proveedor,
// producto, marca y categoría, serie mensual y tops, con Excel y PDF. Montos sin
// IGV ni gastos. Funciones puras.

const pct = (share: number | undefined) => (typeof share === "number" ? `${Math.round(share * 100)}%` : "—");
const num = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** ¿La API mandó montos? (sin permiso los omite). */
export const purchasesHaveAmounts = (report: Pick<PurchasesReport, "totals">): boolean => "amount" in (report.totals ?? {});

/** Proveedores de cada producto, juntando los de sus variantes. */
export function productSuppliers(report: Pick<PurchasesReport, "byVariant">): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const variant of report.byVariant) {
    const key = variant.productId ?? `variante:${variant.variantId}`;
    const set = out.get(key) ?? new Set<string>();
    for (const supplier of variant.suppliers ?? []) set.add(supplier.supplierName || "Sin proveedor");
    out.set(key, set);
  }
  return new Map([...out].map(([key, set]) => [key, [...set].sort((a, b) => a.localeCompare(b, "es"))]));
}

export const supplierNamesText = (value: string[] | string | null | undefined): string =>
  Array.isArray(value) ? value.join(", ") : value || "—";

export function purchasesReportWorkbook(report: PurchasesReport, options: { rangeLabel: string; generatedBy?: string; now?: Date }) {
  const amounts = purchasesHaveAmounts(report);
  const money = amounts ? [{ header: "Monto sin IGV", key: "amount", numFmt: MONEY_FMT }] : [];
  return buildReportWorkbook({
    title: "Reporte de compras",
    filters: [
      ["Periodo", options.rangeLabel],
      ["Desde", formatYmd(report.from)],
      ["Hasta", formatYmd(report.to)],
      ["Montos", "Sin IGV ni gastos. Órdenes emitidas y compras directas recibidas; sin borradores ni anuladas."],
    ],
    generatedBy: options.generatedBy,
    generatedAt: options.now,
    sheets: [
      {
        name: "Proveedores",
        columns: [
          { header: "Proveedor", key: "name", width: 30 },
          ...money,
          ...(amounts ? [{ header: "Participación", key: "share", width: 14 }] : []),
          { header: "Unidades", key: "units", numFmt: QTY_FMT },
          { header: "Órdenes", key: "orders", numFmt: QTY_FMT },
          { header: "Última compra", key: "last", width: 14 },
        ],
        rows: report.bySupplier.map((row) => ({ name: row.supplierName || "Sin proveedor", amount: num(row.amount), share: pct(row.share), units: row.units, orders: row.orders, last: formatYmd(row.lastDate) })),
      },
      {
        name: "Productos",
        columns: [
          { header: "Producto", key: "name", width: 34 },
          { header: "Marca", key: "brand", width: 16 },
          { header: "Categoría", key: "category", width: 18 },
          { header: "Unidades", key: "units", numFmt: QTY_FMT },
          ...money,
          ...(amounts ? [{ header: "Costo prom.", key: "avg", numFmt: COST_FMT }] : []),
        ],
        rows: report.byProduct.map((row) => ({
          name: row.productName || "Producto fuera del catálogo",
          brand: row.brandName || "Sin marca",
          category: row.categoryName || "Sin categoría",
          units: row.units,
          amount: num(row.amount),
          avg: typeof row.amount === "number" && row.units > 0 ? row.amount / row.units : null,
        })),
      },
      {
        name: "Variantes",
        columns: [
          { header: "SKU", key: "sku", width: 18 },
          { header: "Producto", key: "name", width: 34 },
          { header: "Variante", key: "variant", width: 22 },
          { header: "Unidades", key: "units", numFmt: QTY_FMT },
          ...money,
          ...(amounts ? [{ header: "Costo prom.", key: "avg", numFmt: COST_FMT }] : []),
          { header: "Proveedores", key: "suppliers", width: 30 },
        ],
        rows: report.byVariant.map((row) => ({
          sku: row.sku || "",
          name: row.productName || "",
          variant: formatVariantLabel(row.attributes),
          units: row.units,
          amount: num(row.amount),
          avg: num(row.averageUnitCost),
          suppliers: (row.suppliers ?? []).map((supplier) => supplier.supplierName || "Sin proveedor").join(", "),
        })),
      },
      {
        name: "Marcas",
        columns: [{ header: "Marca", key: "name", width: 24 }, { header: "Unidades", key: "units", numFmt: QTY_FMT }, ...money, ...(amounts ? [{ header: "Participación", key: "share" }] : [])],
        rows: report.byBrand.map((row) => ({ name: row.brandName || "Sin marca", units: row.units, amount: num(row.amount), share: pct(row.share) })),
      },
      {
        name: "Categorías",
        columns: [{ header: "Categoría", key: "name", width: 24 }, { header: "Unidades", key: "units", numFmt: QTY_FMT }, ...money, ...(amounts ? [{ header: "Participación", key: "share" }] : [])],
        rows: report.byCategory.map((row) => ({ name: row.categoryName || "Sin categoría", units: row.units, amount: num(row.amount), share: pct(row.share) })),
      },
      {
        name: "Por mes",
        columns: [{ header: "Mes", key: "month", width: 18 }, ...money, { header: "Unidades", key: "units", numFmt: QTY_FMT }, { header: "Órdenes", key: "orders", numFmt: QTY_FMT }],
        rows: report.byMonth.map((row) => ({ month: periodLabel(row.month), amount: num(row.amount), units: row.units, orders: row.orders })),
      },
      {
        name: "Órdenes",
        columns: [
          { header: "Fecha", key: "date", width: 12 },
          { header: "Orden", key: "number", width: 14 },
          { header: "Proveedor", key: "supplier", width: 30 },
          { header: "Unidades", key: "units", numFmt: QTY_FMT },
          ...money,
        ],
        rows: report.orders.map((row) => ({ date: formatYmd(row.date), number: row.number, supplier: supplierNamesText(row.supplierNames), units: row.units, amount: num(row.amount) })),
      },
    ],
  });
}

export function purchasesReportPdfSpec(report: PurchasesReport, options: { rangeLabel: string }): PdfDocSpec {
  const amounts = purchasesHaveAmounts(report);
  const money = (value: number | undefined) => formatMoney(value);
  return {
    title: "Reporte de compras",
    number: options.rangeLabel,
    meta: [
      ["Desde", formatYmd(report.from)],
      ["Hasta", formatYmd(report.to)],
      ["Total sin IGV", amounts ? money(report.totals.amount) : "••••"],
      ["Órdenes", String(report.totals.orders)],
      ["Unidades", String(report.totals.units)],
      ["Proveedores", String(report.totals.suppliers)],
    ],
    tables: [
      {
        title: "Proveedores",
        head: ["Proveedor", "Monto sin IGV", "Participación", "Unidades", "Órdenes", "Última"],
        rows: report.bySupplier.map((row) => [row.supplierName || "Sin proveedor", money(row.amount), pct(row.share), String(row.units), String(row.orders), formatYmd(row.lastDate)]),
        align: ["left", "right", "right", "right", "right", "left"],
      },
      {
        title: "Productos más comprados",
        head: ["Producto", "Unidades", "Monto sin IGV", "Costo prom."],
        rows: report.topProducts.map((row) => [
          row.productName || "Producto fuera del catálogo",
          String(row.units),
          money(row.amount),
          typeof row.amount === "number" && row.units > 0 ? formatMoney(row.amount / row.units, 4) : amounts ? "—" : "••••",
        ]),
        align: ["left", "right", "right", "right"],
      },
      {
        title: "Por marca",
        head: ["Marca", "Unidades", "Monto sin IGV", "Participación"],
        rows: report.byBrand.map((row) => [row.brandName || "Sin marca", String(row.units), money(row.amount), pct(row.share)]),
        align: ["left", "right", "right", "right"],
      },
      {
        title: "Por categoría",
        head: ["Categoría", "Unidades", "Monto sin IGV", "Participación"],
        rows: report.byCategory.map((row) => [row.categoryName || "Sin categoría", String(row.units), money(row.amount), pct(row.share)]),
        align: ["left", "right", "right", "right"],
      },
      {
        title: "Por mes",
        head: ["Mes", "Monto sin IGV", "Unidades", "Órdenes"],
        rows: report.byMonth.map((row) => [periodLabel(row.month), money(row.amount), String(row.units), String(row.orders)]),
        align: ["left", "right", "right", "right"],
      },
    ],
    note: "Montos sin IGV ni gastos. Salen de las órdenes de compra emitidas y de las compras directas recibidas; no cuentan borradores ni anuladas.",
    fileName: `reporte-compras-${report.from}-${report.to}`,
  };
}
