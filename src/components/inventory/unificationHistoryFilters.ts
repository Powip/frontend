import type { UnificationHistoryItem, UnificationVia } from "@/services/unification.service";
import { ACTION_LABEL, STOCK_MODE_LABEL, VIA_LABEL, variantDisplayLabel } from "./unificationRules";

// FEAT-24 H11 — filtros del Historial (fecha, usuario, vía) y exportación a
// CSV, sin React para poder testearlos solos. Las fechas se eligen en hora de
// Lima y viajan como instantes ISO (el backend filtra `resolved_at`).

export const LIMA_TIME_ZONE = "America/Lima";
// Lima está en UTC−5 todo el año (sin horario de verano).
const LIMA_OFFSET = "-05:00";
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type HistoryDatePreset = "" | "today" | "7d" | "30d" | "range";

export const HISTORY_DATE_PRESETS: Array<{ value: HistoryDatePreset; label: string }> = [
  { value: "", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "range", label: "Rango de fechas" },
];

export const HISTORY_VIA_OPTIONS: Array<{ value: "" | UnificationVia; label: string }> = [
  { value: "", label: "Todas las vías" },
  { value: "bandeja", label: VIA_LABEL.bandeja },
  { value: "union_manual", label: VIA_LABEL.union_manual },
];

export const RANGE_ORDER_ERROR = "La fecha «desde» es posterior a la fecha «hasta».";

/** Día de hoy en Lima, `AAAA-MM-DD`. */
export function limaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

function limaInstant(day: string, time: string): string | undefined {
  if (!DAY_PATTERN.test(day)) return undefined;
  const instant = new Date(`${day}T${time}${LIMA_OFFSET}`);
  return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString();
}

/** 00:00:00.000 del día en Lima, como instante ISO. */
export const limaDayStart = (day: string) => limaInstant(day, "00:00:00.000");
/** 23:59:59.999 del día en Lima, como instante ISO. */
export const limaDayEnd = (day: string) => limaInstant(day, "23:59:59.999");

export interface HistoryDateRange {
  from?: string;
  to?: string;
  /** Rango imposible: no se consulta y se muestra el mensaje. */
  error: string | null;
}

/**
 * Rango de fechas del filtro. «Hoy» y «Últimos N días» cuentan días enteros de
 * Lima hasta ahora (incluido hoy). En un rango propio cada extremo es opcional
 * y los dos se incluyen enteros.
 */
export function historyDateRange(
  preset: HistoryDatePreset,
  desde: string,
  hasta: string,
  now: Date = new Date(),
): HistoryDateRange {
  const today = limaToday(now);
  switch (preset) {
    case "today":
      return { from: limaDayStart(today), error: null };
    case "7d":
      return { from: limaDayStart(shiftDay(today, -6)), error: null };
    case "30d":
      return { from: limaDayStart(shiftDay(today, -29)), error: null };
    case "range": {
      const from = limaDayStart(desde);
      const to = limaDayEnd(hasta);
      if (from && to && from > to) return { error: RANGE_ORDER_ERROR };
      return { from, to, error: null };
    }
    default:
      return { error: null };
  }
}

/** Correo para filtrar: sin espacios alrededor; vacío = sin filtro. */
export function normalizeEmailFilter(raw: string): string | undefined {
  const value = raw.trim().slice(0, 320);
  return value === "" ? undefined : value;
}

// ---------------------------------------------------------------------------
// Textos de una fila (los usa la tabla y el CSV).

export function formatHistoryDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: LIMA_TIME_ZONE });
}

export function historyActionLabel(item: UnificationHistoryItem): string {
  if (item.action) return ACTION_LABEL[item.action];
  return item.status === "rejected" ? ACTION_LABEL.reject : "Aplicada";
}

export function historyStockText(item: UnificationHistoryItem): string {
  if (!item.stock_mode) return item.derived ? "Sin detalle" : "—";
  if (item.stock_mode === "count") return `${STOCK_MODE_LABEL.count}: ${item.counted_quantity ?? "—"}`;
  return STOCK_MODE_LABEL[item.stock_mode];
}

/** Nombres de lo que no se unió en una rechazada sin ganadora ni perdedoras. */
export function historyRejectedNames(item: UnificationHistoryItem): string[] {
  if (item.status !== "rejected" || item.winner || item.losers.length > 0) return [];
  return item.items.map((taskItem) => taskItem.variant_name).filter((name): name is string => Boolean(name));
}

// ---------------------------------------------------------------------------
// CSV (como el mockup: con BOM para Excel, `;` y todo entre comillas).

export const historyCsvFilename = (now: Date = new Date()) => `powip_historial_unificacion_${limaToday(now)}.csv`;

type CsvValue = string | number | null | undefined;

/** Celda entre comillas. Un texto que empieza con = + - @ se antepone con ' para que Excel no lo tome como fórmula. */
function csvCell(value: CsvValue): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const variantText = (variant: { product_name: string; attribute_values: Record<string, string> }) =>
  `${variant.product_name || "Variante sin nombre"} · ${variantDisplayLabel(variant.attribute_values)}`;

const skuText = (variant: { company_sku: string | null; sku: string | null }) => variant.company_sku || variant.sku || "";

/** CSV del historial. La columna «Costo» va solo para quien ve costos. */
export function buildHistoryCsv(rows: UnificationHistoryItem[], showCost: boolean): string {
  const header = [
    "Fecha",
    "Usuario",
    "Estado",
    "Acción",
    "Vía",
    "Queda (madre)",
    "SKU madre",
    "Se unió",
    "SKU de las que se unieron",
    "Stock",
    ...(showCost ? ["Costo"] : []),
    "Detalle reconstruido",
  ];
  const lines = rows.map((item) => {
    const rejected = historyRejectedNames(item);
    const joined = item.losers.length > 0
      ? item.losers.map(variantText).join(" | ")
      : rejected.length > 0
        ? `No se unió: ${rejected.join(" | ")}`
        : "";
    return [
      formatHistoryDate(item.resolved_at ?? item.created_at),
      item.resolved_by.email ?? "",
      item.status === "rejected" ? "Rechazada" : "Aplicada",
      historyActionLabel(item),
      VIA_LABEL[item.via] ?? item.via,
      item.winner ? variantText(item.winner) : "",
      item.winner ? skuText(item.winner) : "",
      joined,
      item.losers.map(skuText).filter(Boolean).join(" | "),
      historyStockText(item),
      ...(showCost ? [item.price_base === null ? "" : Number(item.price_base).toFixed(2)] : []),
      item.derived ? "Sí" : "No",
    ];
  });
  return `﻿${[header, ...lines].map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
}
