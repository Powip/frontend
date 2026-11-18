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
}

/** Regla en una línea: «Lleva 3 de Polo y paga S/ 90.00 por las 3», «Por compras desde S/ 150.00 regala 1 × Gorra». */
export function promoRuleText(promo: Promotion, names: PromoNames): string {
  if (promo.type === "VOLUME") {
    const min = promo.minQty ?? 0;
    const range = promo.maxQty ? `${min} a ${promo.maxQty}` : String(min);
    return `Lleva ${range} de ${names.product(promo.productId)} y paga ${soles(promo.packPrice)} por cada ${min}`;
  }
  const gift = `regala ${promo.giftQuantity ?? 1} × ${names.variant(promo.giftVariantId)}`;
  if (promo.giftCondition === "AMOUNT") return `Por compras desde ${soles(promo.minAmount)}, ${gift}`;
  if (promo.giftCondition === "PRODUCT") return `Al comprar ${promo.minQty ?? 1} de ${names.product(promo.productId)}, ${gift}`;
  if (promo.giftCondition === "VARIANT") return `Al comprar ${promo.minQty ?? 1} × ${names.variant(promo.triggerVariantId)}, ${gift}`;
  return gift.charAt(0).toUpperCase() + gift.slice(1);
}
