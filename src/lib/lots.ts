import { formatVariantLabel } from "@/lib/variantAttributes";
import type { CatalogVariant } from "@/services/variantCodesService";
import type { LotStatus } from "@/services/lotsService";

// FEAT-24 H5-L — reglas del front de los lotes con vencimiento: textos y
// colores de los estados, validación de lo que se tipea al recibir o registrar
// un lote, los lotes de una fila del kardex y el 409 `LOTE_VENCIDO` del
// despacho. Funciones puras: las pantallas solo las usan. Las reglas de stock
// (FEFO, saldos, vencido) las aplica ms-logistics.

export const LOT_NUMBER_MAX = 40;
export const LOT_COMMENT_MAX = 300;
/** Días de aviso por defecto (reglas de inventario, `expiryAlertDays`). */
export const DEFAULT_EXPIRY_ALERT_DAYS = 30;

/* ---------------------------------------------------------------------------
   Estados
--------------------------------------------------------------------------- */

export type LotTone = "green" | "amber" | "red" | "slate";

export const LOT_TONE_CLASS: Record<LotTone, string> = {
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  slate: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  vigente: "Vigente",
  vencido: "Vencido",
  bloqueado: "Bloqueado",
};

/** «en 5 días», «vence hoy», «vencido hace 3 días»; vacío sin fecha. */
export function expiryText(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "";
  if (days < 0) return `vencido hace ${-days === 1 ? "1 día" : `${-days} días`}`;
  if (days === 0) return "vence hoy";
  return days === 1 ? "en 1 día" : `en ${days} días`;
}

/**
 * Estado que se ve: «Vencido», «Bloqueado», «Por vencer · 5 días» (vigente dentro de los días de aviso) o
 * «Vigente». El lote DEVOLUCION (sin fecha) es vigente.
 */
export function lotStatusView(
  lot: { status: LotStatus | string; daysToExpiry: number | null },
  alertDays: number = DEFAULT_EXPIRY_ALERT_DAYS,
): { label: string; tone: LotTone } {
  if (lot.status === "vencido") return { label: "Vencido", tone: "red" };
  if (lot.status === "bloqueado") return { label: "Bloqueado", tone: "slate" };
  if (lot.daysToExpiry !== null && lot.daysToExpiry !== undefined && lot.daysToExpiry <= alertDays) {
    return { label: lot.daysToExpiry <= 0 ? "Vence hoy" : `Por vencer · ${lot.daysToExpiry === 1 ? "1 día" : `${lot.daysToExpiry} días`}`, tone: "amber" };
  }
  return { label: "Vigente", tone: "green" };
}

/** `YYYY-MM-DD` → «dd/mm/aaaa» (sin zona: es un día). Sin importar purchaseOrders, que usa este módulo. */
export function lotDay(value: string | null | undefined): string {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return ymd ? `${ymd[3]}/${ymd[2]}/${ymd[1]}` : "—";
}

/** Fecha de vencimiento «dd/mm/aaaa» (o «Sin fecha»). */
export const lotDate = (value: string | null | undefined): string => (value ? lotDay(value) : "Sin fecha");

/** «L2408 · vence 30/08/2027» (el lote DEVOLUCION no tiene fecha). */
export function lotLabel(lot: { number: string; expiresAt: string | null; kind?: string | null }): string {
  if (lot.kind === "devolucion" || !lot.expiresAt) return lot.number;
  return `${lot.number} · vence ${lotDay(lot.expiresAt)}`;
}

/* ---------------------------------------------------------------------------
   Lo que se tipea (recepción de OC y «Registrar lote»)
--------------------------------------------------------------------------- */

/** `YYYY-MM-DD` de una fecha real (lo que manda un `<input type="date">`). */
export function isIsoDate(value: string | null | undefined): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

/** Número y vencimiento de un lote nuevo (o `null` si está bien). */
export function newLotProblem(lot: { lotNumber: string; expiresAt: string; comment?: string }): string | null {
  const number = lot.lotNumber.trim();
  if (!number) return "Escribe el número de lote.";
  if (number.length > LOT_NUMBER_MAX) return `El número de lote tiene hasta ${LOT_NUMBER_MAX} caracteres.`;
  if (!lot.expiresAt) return "Elige la fecha de vencimiento.";
  if (!isIsoDate(lot.expiresAt)) return "La fecha de vencimiento no es válida.";
  if ((lot.comment ?? "").trim().length > LOT_COMMENT_MAX) return `El comentario tiene hasta ${LOT_COMMENT_MAX} caracteres.`;
  return null;
}

/** Clave de un lote sin distinguir mayúsculas (el servidor lo reutiliza por número así). */
export const lotKey = (number: string): string => number.trim().toUpperCase();

/* ---------------------------------------------------------------------------
   Kardex
--------------------------------------------------------------------------- */

export interface KardexLot {
  lotId: string | null;
  lotNumber: string | null;
  expiresAt?: string | null;
  quantity: number;
}

/** Lotes de una fila del kardex (`lots`; `lotAllocations` por si la fachada lo renombra). `null` = sin lotes. */
export function kardexLotsOf(row: { lots?: KardexLot[] | null; lotAllocations?: KardexLot[] | null }): KardexLot[] | null {
  const list = Array.isArray(row.lots) ? row.lots : Array.isArray(row.lotAllocations) ? row.lotAllocations : null;
  return list && list.length ? list : null;
}

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}`;

/** «L2408 −3 · Sin lote −1» (para la tabla y el Excel). */
export function kardexLotsText(lots: KardexLot[] | null): string {
  if (!lots) return "";
  return lots.map((lot) => `${lot.lotId ? lot.lotNumber || "Lote" : "Sin lote"} ${signed(Number(lot.quantity) || 0)}`).join(" · ");
}

/* ---------------------------------------------------------------------------
   Errores (409 de logistics con `code`)
--------------------------------------------------------------------------- */

interface ApiErrorShape {
  response?: { status?: number; data?: { message?: unknown; code?: unknown; required?: unknown; usable?: unknown; lots?: unknown } };
}

const dataOf = (error: unknown) => (error as ApiErrorShape | null)?.response?.data;
const statusOf = (error: unknown) => (error as ApiErrorShape | null)?.response?.status;

function messageOf(error: unknown): string | null {
  const message = dataOf(error)?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part.trim() !== "");
    return parts.length ? parts.map((part) => part.trim()).join(". ") : null;
  }
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

export const lotErrorCode = (error: unknown): string | undefined => {
  const code = dataOf(error)?.code;
  return typeof code === "string" ? code : undefined;
};

/**
 * ¿La recepción falló por el lote (409 `LOTE_VENCIMIENTO_DISTINTO`: el número ya existe con otra fecha)? Se corrige el
 * lote, no hace falta refrescar la OC. Desde la cola del celular llega solo el mensaje (sin `code`).
 */
export function isLotReceiveConflict(error: unknown): boolean {
  if (statusOf(error) !== 409) return false;
  if (lotErrorCode(error) === "LOTE_VENCIMIENTO_DISTINTO") return true;
  return /ya existe con vencimiento/i.test(messageOf(error) ?? "");
}

/**
 * ¿El despacho falló porque solo quedan lotes vencidos o bloqueados? ms-logistics responde 409 `LOTE_VENCIDO`; ms-ventas
 * reenvía solo el mensaje (sin `code`), así que también se reconoce por el texto.
 */
export function isExpiredLotError(error: unknown): boolean {
  if (statusOf(error) !== 409) return false;
  if (lotErrorCode(error) === "LOTE_VENCIDO") return true;
  return /lotes? vencidos? o bloqueados?/i.test(messageOf(error) ?? "");
}

/**
 * Mensaje claro del 409 `LOTE_VENCIDO` al despachar o completar el picking (o `null` si es otro error):
 * «Solo quedan lotes vencidos o bloqueados de X: …» con qué hacer. `product` es el nombre del producto o del pedido.
 */
export function expiredLotDispatchMessage(error: unknown, product?: string | null): string | null {
  if (!isExpiredLotError(error)) return null;
  const data = dataOf(error);
  const required = Number(data?.required);
  const usable = Number(data?.usable);
  const lots = Array.isArray(data?.lots) ? (data.lots as Array<{ number?: unknown; status?: unknown; expiresAt?: unknown; quantity?: unknown }>) : [];
  const blocked = lots
    .filter((lot) => lot.status === "vencido" || lot.status === "bloqueado")
    .map((lot) => {
      const status = lot.status === "bloqueado" ? "bloqueado" : `vencido${typeof lot.expiresAt === "string" ? ` el ${lotDay(lot.expiresAt)}` : ""}`;
      return `${String(lot.number ?? "Lote")} (${status}, ${Number(lot.quantity) || 0} und)`;
    });
  const detail = Number.isFinite(required) && Number.isFinite(usable) && data?.required !== undefined
    ? ` Hay ${usable} ${usable === 1 ? "unidad vigente" : "unidades vigentes"} para despachar ${required}.`
    : messageOf(error)
      ? ` ${messageOf(error)}`
      : "";
  const which = blocked.length ? ` Lotes: ${blocked.join(", ")}.` : "";
  const what = product?.trim() ? ` de ${product.trim()}` : "";
  return (
    `Solo quedan lotes vencidos o bloqueados${what}: no se puede despachar.${detail}${which}` +
    " Registra la merma del lote vencido, desbloquéalo en la ficha del producto (pestaña Lotes) o recibe stock nuevo."
  ).replace(/\.\./g, ".");
}

/**
 * Mensaje de un error al recibir o registrar un lote: los 409 de lotes (`LOTE_VENCIMIENTO_DISTINTO`, `LOTE_SIN_SALDO`)
 * traen el lote y qué revisar en el mensaje del servidor; si no hay mensaje, el `fallback`.
 */
export function lotWriteErrorMessage(error: unknown, fallback: string): string {
  const code = lotErrorCode(error);
  const text = messageOf(error);
  if (code === "LOTE_VENCIMIENTO_DISTINTO") return text ?? "Ese lote ya existe con otra fecha de vencimiento: revisa la fecha o usa otro número.";
  if (code === "LOTE_SIN_SALDO") return text ?? "El lote elegido no tiene tantas unidades en este almacén.";
  return text ?? fallback;
}

/* ---------------------------------------------------------------------------
   Nombre de la variante (los lotes solo traen `variantId`)
--------------------------------------------------------------------------- */

export interface VariantName {
  name: string;
  sku: string;
}

/** Nombre y SKU de cada variante (de `fetchVariantsByIds`). */
export function variantNames(variants: readonly CatalogVariant[]): Map<string, VariantName> {
  const map = new Map<string, VariantName>();
  for (const variant of variants) {
    const attributes = formatVariantLabel(variant.attributeValues);
    map.set(variant.id, { name: [variant.productName || "Variante", attributes].filter(Boolean).join(" · "), sku: variant.companySku || variant.sku });
  }
  return map;
}
