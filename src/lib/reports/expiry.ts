import { expiryText, lotDay, type VariantName } from "@/lib/lots";
import type { PdfDocSpec } from "@/lib/pdf/document";
import { formatMoney } from "@/lib/purchaseOrders";
import type { ExpiringLotRow, ExpiringLots } from "@/services/lotsService";
import { buildReportWorkbook, COST_FMT, MONEY_FMT, QTY_FMT, type SheetColumn } from "./excel";
import { formatYmd } from "./periods";

// FEAT-24 H5-L — «Vencimiento en dinero» (mockup vencHTML, dentro de Alertas):
// lo vencido, lo que vence dentro de los días de aviso y lo que vence después
// (hasta 90 días), al costo promedio; y lo perdido por vencimiento de los
// últimos 4 meses. Sin rol de costos la fachada omite los montos: «••••».
// Funciones puras (pantalla, Excel y PDF).

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** ¿La fachada mandó los montos? (sin rol de costos los omite). */
export const expiryHasCosts = (data: Pick<ExpiringLots, "totals">): boolean => "value" in data.totals.all;

/** «Octubre» (el mes en curso: «Noviembre (a la fecha)»). */
export function expiryPeriodLabel(period: string, current: boolean): string {
  const month = Number(period.slice(5, 7));
  const name = MONTHS[month - 1] ?? period;
  return current ? `${name} (a la fecha)` : name;
}

export type ExpiryTone = "red" | "amber" | "neutral";

/** Rojo si ya venció, ámbar si vence dentro de los días de aviso. */
export function expiryTone(row: Pick<ExpiringLotRow, "status" | "daysToExpiry">, alertDays: number): ExpiryTone {
  if (row.status === "vencido" || (row.daysToExpiry ?? 0) < 0) return "red";
  if ((row.daysToExpiry ?? Infinity) <= alertDays) return "amber";
  return "neutral";
}

/** «Vencido hace 18 días», «Vence hoy», «En 7 días» (+ « · Bloqueado»). */
export function expiryLabel(row: Pick<ExpiringLotRow, "status" | "daysToExpiry">): string {
  const text = expiryText(row.daysToExpiry);
  const base = text ? text.charAt(0).toUpperCase() + text.slice(1) : row.status === "vencido" ? "Vencido" : "Sin fecha";
  return row.status === "bloqueado" ? `${base} · Bloqueado` : base;
}

/** Total perdido por vencimiento en los meses que trae la fachada (`undefined` sin rol de costos). */
export function lostTotal(data: Pick<ExpiringLots, "lostByExpiry">): number | undefined {
  if (data.lostByExpiry.some((month) => !("value" in month))) return undefined;
  return data.lostByExpiry.reduce((sum, month) => sum + (Number(month.value) || 0), 0);
}

/** «Ago S/ 129,60 · Sep S/ 84,30 · Nov ••••». */
export function lostByMonthText(data: Pick<ExpiringLots, "lostByExpiry">): string {
  return data.lostByExpiry.map((month) => `${expiryPeriodLabel(month.period, false).slice(0, 3)} ${formatMoney(month.value)}`).join(" · ");
}

const nameOf = (names: ReadonlyMap<string, VariantName>, variantId: string) => names.get(variantId) ?? { name: "Variante", sku: "" };

export function expiryFilterRows(state: { inventoryName: string; days: number; alertDays: number }): Array<[string, string]> {
  return [
    ["Almacén", state.inventoryName || "Todos los almacenes"],
    ["Vence en", `${state.days} días o menos (y lo ya vencido)`],
    ["Días de aviso", String(state.alertDays)],
  ];
}

export function expiryWorkbook(
  data: ExpiringLots,
  options: { names: ReadonlyMap<string, VariantName>; filters: Array<[string, string]>; generatedBy?: string; now?: Date },
) {
  const costs = expiryHasCosts(data);
  const columns: SheetColumn[] = [
    { header: "Producto", key: "product", width: 36 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Lote", key: "lot", width: 16 },
    { header: "Almacén", key: "warehouse", width: 20 },
    { header: "Vence", key: "expiresAt", width: 12 },
    { header: "Días", key: "days", numFmt: QTY_FMT },
    { header: "Estado", key: "status", width: 26 },
    { header: "Unidades", key: "units", numFmt: QTY_FMT },
    ...(costs
      ? [
          { header: "Costo prom.", key: "averageCost", numFmt: COST_FMT },
          { header: "Valor", key: "value", numFmt: MONEY_FMT },
        ]
      : []),
  ];
  const filters = data.truncated ? [...options.filters, ["Aviso", "Hay más lotes de los que se muestran: se exportaron los primeros."] as [string, string]] : options.filters;
  return buildReportWorkbook({
    title: "Vencimiento en dinero",
    filters,
    generatedBy: options.generatedBy,
    generatedAt: options.now,
    sheets: [
      {
        name: "Lotes por vencer",
        columns,
        rows: data.items.map((row) => {
          const variant = nameOf(options.names, row.variantId);
          return {
            product: variant.name,
            sku: variant.sku,
            lot: row.lotNumber,
            warehouse: row.inventoryName ?? "",
            expiresAt: row.expiresAt ? lotDay(row.expiresAt) : "",
            days: row.daysToExpiry,
            status: expiryLabel(row),
            units: row.quantity,
            averageCost: row.averageCost ?? null,
            value: row.value ?? null,
          };
        }),
      },
      {
        name: "Perdido por vencimiento",
        columns: [
          { header: "Mes", key: "month", width: 24 },
          { header: "Unidades", key: "units", numFmt: QTY_FMT },
          ...(costs ? [{ header: "Valor", key: "value", numFmt: MONEY_FMT }, { header: "Unidades sin costo", key: "withoutCost", numFmt: QTY_FMT }] : []),
        ],
        rows: data.lostByExpiry.map((month, index) => ({
          month: `${expiryPeriodLabel(month.period, index === data.lostByExpiry.length - 1)} ${month.period.slice(0, 4)}`,
          units: month.units,
          value: month.value ?? null,
          withoutCost: month.unitsWithoutCost ?? 0,
        })),
      },
    ],
  });
}

export function expiryPdfSpec(
  data: ExpiringLots,
  options: { names: ReadonlyMap<string, VariantName>; filters: Array<[string, string]>; today: string },
): PdfDocSpec {
  const { expired, withinAlert, later } = data.totals;
  return {
    title: "Vencimiento en dinero",
    number: formatYmd(options.today),
    meta: options.filters,
    tables: [
      {
        head: ["Producto", "SKU", "Lote", "Almacén", "Vence", "Estado", "Unidades", "Valor"],
        rows: data.items.map((row) => {
          const variant = nameOf(options.names, row.variantId);
          return [variant.name, variant.sku, row.lotNumber, row.inventoryName ?? "", row.expiresAt ? lotDay(row.expiresAt) : "", expiryLabel(row), row.quantity, formatMoney(row.value)];
        }),
        align: ["left", "left", "left", "left", "left", "left", "right", "right"],
      },
      {
        title: "Perdido por vencimiento",
        head: ["Mes", "Unidades", "Valor"],
        rows: data.lostByExpiry.map((month, index) => [
          `${expiryPeriodLabel(month.period, index === data.lostByExpiry.length - 1)} ${month.period.slice(0, 4)}`,
          month.units,
          formatMoney(month.value),
        ]),
        align: ["left", "right", "right"],
      },
    ],
    foot: [
      ["Ya vencido", formatMoney(expired.value)],
      [`Vence en ${data.alertDays} días`, formatMoney(withinAlert.value)],
      [`Vence en ${data.alertDays + 1}–${data.days} días`, formatMoney(later.value)],
      ["Perdido por vencimiento", formatMoney(lostTotal(data))],
    ],
    landscape: true,
    fileName: `vencimiento-${options.today}`,
  };
}
