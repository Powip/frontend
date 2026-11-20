import { formatVariantLabel } from "@/lib/variantAttributes";
import type { PeriodClose, PeriodCloseDetail, PeriodCloseList } from "@/services/inventoryReportsService";
import { buildReportWorkbook, COST_FMT, MONEY_FMT, QTY_FMT } from "./excel";
import { periodLabel, shiftPeriod } from "./periods";

// FEAT-24 H10-D6 — Cierre mensual (mockup vCierre): filas de la lista, qué se
// puede cerrar o reabrir y el Excel de la foto. Funciones puras.

export type PeriodRowKind = "cerrado" | "reabierto" | "por_cerrar" | "en_curso";

export interface PeriodRow {
  period: string;
  kind: PeriodRowKind;
  close: PeriodClose | null;
  /** Solo el último mes cerrado se puede reabrir (si hay uno posterior cerrado, la API da 409). */
  canReopen: boolean;
  /** El próximo mes a cerrar (uno sin cerrar o uno reabierto). */
  canClose: boolean;
}

export const PERIOD_KIND_LABEL: Record<PeriodRowKind, string> = {
  cerrado: "Cerrado",
  reabierto: "Reabierto",
  por_cerrar: "Abierto",
  en_curso: "En curso",
};

/** Filas de la lista, del mes más nuevo al más viejo: el mes en curso, el próximo a cerrar y los cierres. */
export function periodRows(list: PeriodCloseList): PeriodRow[] {
  const byPeriod = new Map(list.items.map((item) => [item.period, item]));
  const latestClosed = list.items.filter((item) => item.status === "cerrado").map((item) => item.period).sort().at(-1) ?? null;
  const rows: PeriodRow[] = list.items.map((item) => ({
    period: item.period,
    kind: item.status === "cerrado" ? "cerrado" : "reabierto",
    close: item,
    canReopen: item.status === "cerrado" && item.period === latestClosed,
    canClose: item.status === "reabierto" && item.period === list.nextToClose,
  }));
  if (list.nextToClose && !byPeriod.has(list.nextToClose)) {
    rows.push({ period: list.nextToClose, kind: "por_cerrar", close: null, canReopen: false, canClose: true });
  }
  if (list.currentPeriod && !byPeriod.has(list.currentPeriod) && list.currentPeriod !== list.nextToClose) {
    rows.push({ period: list.currentPeriod, kind: "en_curso", close: null, canReopen: false, canClose: false });
  }
  return rows.sort((a, b) => b.period.localeCompare(a.period));
}

/** «Se puede cerrar desde el 1 de diciembre». */
export const closableFromText = (period: string): string => `Se puede cerrar desde el 1 de ${periodLabel(shiftPeriod(period, 1)).split(" ")[0].toLowerCase()}.`;

export const REOPEN_REASON_MIN = 3;
export const REOPEN_REASON_MAX = 500;

export function reopenReasonError(reason: string): string | null {
  const text = reason.trim();
  if (text.length < REOPEN_REASON_MIN) return "Escribe el motivo (al menos 3 caracteres).";
  if (text.length > REOPEN_REASON_MAX) return "El motivo puede tener hasta 500 caracteres.";
  return null;
}

export function periodCloseWorkbook(detail: PeriodCloseDetail, options: { generatedBy?: string; now?: Date } = {}) {
  const costs = "totalValue" in detail;
  return buildReportWorkbook({
    title: `Inventario al cierre de ${periodLabel(detail.period)}`,
    filters: [
      ["Mes", periodLabel(detail.period)],
      ["Estado", detail.status === "cerrado" ? "Cerrado" : "Reabierto"],
      ["Cerrado por", detail.closedByName || detail.closedBy || "—"],
      ["Variantes", String(detail.itemsCount)],
      ["Unidades", String(detail.units)],
      ["Sin costo", `${detail.uncostedItems} ítems · ${detail.uncostedUnits} und`],
      ...(detail.status === "reabierto" ? ([["Motivo de la reapertura", detail.reopenReason || "—"]] as Array<[string, string]>) : []),
    ],
    generatedBy: options.generatedBy,
    generatedAt: options.now,
    sheets: [
      {
        name: "Foto del cierre",
        columns: [
          { header: "Almacén", key: "warehouse", width: 22 },
          { header: "SKU", key: "sku", width: 18 },
          { header: "Producto", key: "product", width: 36 },
          { header: "Físico", key: "physical", numFmt: QTY_FMT },
          { header: "Reservado", key: "reserved", numFmt: QTY_FMT },
          ...(costs
            ? [
                { header: "Costo prom.", key: "averageCost", numFmt: COST_FMT },
                { header: "Valor", key: "value", numFmt: MONEY_FMT },
              ]
            : []),
        ],
        rows: detail.items.map((item) => ({
          warehouse: item.inventoryName ?? "",
          sku: item.sku ?? "",
          product: [item.productName || "Variante fuera del catálogo", formatVariantLabel(item.attributes)].filter(Boolean).join(" · "),
          physical: item.physical,
          reserved: item.reserved,
          averageCost: item.averageCost ?? null,
          value: item.value ?? null,
        })),
      },
    ],
  });
}
