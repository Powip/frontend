/**
 * FEAT-24 H9 (H9-D5) — textos y vigencia de las promociones. La vigencia se guarda en ISO con `startsAt`
 * incluido y `endsAt` excluido; la pantalla la muestra en días de Lima (UTC−5, sin horario de verano) con
 * «hasta» incluido.
 */
import type { Promotion } from "@/services/promotionsService";
import { soles } from "@/lib/packs/packMath";

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Día de Lima (yyyy-mm-dd) de un instante. */
export function limaDate(iso: string | Date): string {
  const time = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  return new Date(time - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

/** «Desde» (incluido) → inicio del día en Lima. */
export function startsAtFromDate(date: string): string | null {
  return DATE_RE.test(date) ? `${date}T00:00:00-05:00` : null;
}

/** «Hasta» (incluido) → inicio del día siguiente en Lima (el backend lo toma excluido). */
export function endsAtFromDate(date: string): string | null {
  if (!DATE_RE.test(date)) return null;
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  return `${next}T00:00:00-05:00`;
}

/** `endsAt` (excluido) → último día incluido en Lima. */
export function lastDayFromEndsAt(endsAt: string | null): string {
  return endsAt ? limaDate(new Date(Date.parse(endsAt) - 1)) : "";
}

export type PromoTiming = "vigente" | "programada" | "vencida";

export function promoTiming(promo: Pick<Promotion, "startsAt" | "endsAt">, now: Date = new Date()): PromoTiming {
  if (promo.startsAt && Date.parse(promo.startsAt) > now.getTime()) return "programada";
  if (promo.endsAt && Date.parse(promo.endsAt) <= now.getTime()) return "vencida";
  return "vigente";
}

const fmtDay = (date: string) => date.split("-").reverse().join("/");

export function promoValidityText(promo: Pick<Promotion, "startsAt" | "endsAt">): string {
  const from = promo.startsAt ? fmtDay(limaDate(promo.startsAt)) : "";
  const to = promo.endsAt ? fmtDay(lastDayFromEndsAt(promo.endsAt)) : "";
  if (from && to) return `Del ${from} al ${to}`;
  if (from) return `Desde el ${from}`;
  if (to) return `Hasta el ${to}`;
  return "Sin fecha de fin";
}

export interface PromoNames {
  product: (productId: string | null) => string;
  variant: (variantId: string | null) => string;
  /** FEAT-32 M4 — código del SKU (`null` si todavía no se conoce). */
  sku: (variantId: string | null) => string | null;
}

/**
 * Regla en una línea (FEAT-32 M4, spec §7.12): «3 por S/ 210.00 · hasta 6 u.», «Regalo ACL0356 desde S/ 300.00»,
 * «Regalo 2 × GOR al comprar 1 de Polo».
 */
export function promoRuleText(promo: Promotion, names: PromoNames): string {
  if (promo.type === "VOLUME") {
    const max = promo.maxQty ? ` · hasta ${promo.maxQty} u.` : "";
    return `${promo.minQty ?? 0} por ${soles(promo.packPrice)}${max}`;
  }
  const quantity = promo.giftQuantity && promo.giftQuantity > 1 ? `${promo.giftQuantity} × ` : "";
  const gift = `Regalo ${quantity}${names.sku(promo.giftVariantId) ?? "un SKU"}`;
  if (promo.giftCondition === "AMOUNT") return `${gift} desde ${soles(promo.minAmount)}`;
  if (promo.giftCondition === "PRODUCT") return `${gift} al comprar ${promo.minQty ?? 1} de ${names.product(promo.productId)}`;
  if (promo.giftCondition === "VARIANT")
    return `${gift} al comprar ${promo.minQty ?? 1} × ${names.sku(promo.triggerVariantId) ?? names.variant(promo.triggerVariantId)}`;
  return gift;
}

/** Precio por unidad del volumen («S/ 70.00 c/u»); vacío si falta el precio o la cantidad. */
export function volumeUnitText(promo: Pick<Promotion, "minQty" | "packPrice">): string {
  return promo.minQty && promo.packPrice ? `${soles(promo.packPrice / promo.minQty)} c/u` : "";
}

/** SKUs del volumen para la tabla: los 2 primeros (los que ya se conocen) y «y N más», más el conteo. */
export function volumeSkusText(variantIds: string[], sku: (variantId: string) => string | null): { first: string; count: string } {
  const known = variantIds.slice(0, 2).map(sku).filter((code): code is string => !!code);
  const rest = variantIds.length - known.length;
  return {
    first: known.length ? `${known.join(", ")}${rest > 0 ? ` y ${rest} más` : ""}` : "",
    count: variantIds.length === 1 ? "1 SKU" : `${variantIds.length} SKUs`,
  };
}
