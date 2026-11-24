/**
 * FEAT-32 M3 (spec §6.9) — precio de campaña, igual que ms-ventas (`campaign-rules.ts`):
 * - se calcula sobre el precio del canal de cada variante;
 * - prioridad: precio escrito a mano > descuento propio del producto > descuento general;
 * - estado: Terminada (pasó el fin, aunque esté pausada) > Pausada > Programada > Activa.
 * Las fechas se escriben y se muestran en hora de Lima (UTC−5, sin horario de verano).
 */
import { soles } from "@/lib/packs/packMath";

export type DiscountKind = "PERCENT" | "AMOUNT" | "FINAL";
export type PromoStatus = "ACTIVE" | "SCHEDULED" | "ENDED" | "PAUSED";

export interface Discount {
  type: DiscountKind | null;
  value: number | null;
}

export const CAMPAIGN_NAME_MAX = 80;
export const CAMPAIGN_NAME_CHIPS = ["Cyber Wow", "Black Friday", "Navidad", "Día de la Madre", "Liquidación"] as const;

export const DISCOUNT_OPTIONS: Array<{ value: DiscountKind; label: string; field: string }> = [
  { value: "PERCENT", label: "% de descuento", field: "Porcentaje" },
  { value: "AMOUNT", label: "S/ de descuento", field: "Monto a descontar (S/)" },
  { value: "FINAL", label: "Precio final", field: "Precio final (S/)" },
];

export const STATUS_LABEL: Record<PromoStatus, string> = {
  ACTIVE: "Activa",
  SCHEDULED: "Programada",
  ENDED: "Terminada",
  PAUSED: "Pausada",
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function discountProblem(discount: Discount): string | null {
  if (!discount.type) return "Elige el tipo de descuento.";
  if (discount.value === null || !Number.isFinite(discount.value) || discount.value <= 0) return "Escribe un descuento mayor a 0.";
  if (discount.type === "PERCENT" && discount.value >= 100) return "El porcentaje debe ser menor a 100.";
  return null;
}

export function applyDiscount(base: number, discount: Discount): number {
  const value = Number(discount.value);
  if (discount.type === "PERCENT") return round2(base * (1 - value / 100));
  if (discount.type === "AMOUNT") return round2(base - value);
  if (discount.type === "FINAL") return round2(value);
  return round2(base);
}

export function campaignPrice(input: { base: number; general: Discount; own?: Discount | null; manual?: number | null }): number {
  if (input.manual !== null && input.manual !== undefined && Number.isFinite(input.manual)) return round2(input.manual);
  if (input.own?.type) return applyDiscount(input.base, input.own);
  return applyDiscount(input.base, input.general);
}

/** «−20%», «−S/ 10.00», «Precio final S/ 129.00». */
export function discountLabel(discount: Discount): string {
  if (discount.value === null || !discount.type) return "—";
  if (discount.type === "PERCENT") return `−${Number(discount.value.toFixed(2))}%`;
  if (discount.type === "AMOUNT") return `−${soles(discount.value)}`;
  return `Precio final ${soles(discount.value)}`;
}

export function promoStatus(
  promo: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: Date = new Date(),
): PromoStatus {
  const time = now.getTime();
  if (promo.endsAt && Date.parse(promo.endsAt) <= time) return "ENDED";
  if (!promo.isActive) return "PAUSED";
  if (promo.startsAt && Date.parse(promo.startsAt) > time) return "SCHEDULED";
  return "ACTIVE";
}

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Valor de un `datetime-local` (hora de Lima) → ISO con su zona. */
export function isoFromLimaLocal(value: string): string | null {
  return LOCAL_RE.test(value) ? `${value}:00-05:00` : null;
}

/** ISO → valor de un `datetime-local` en hora de Lima. */
export function limaLocalFromIso(iso: string | null): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time - LIMA_OFFSET_MS).toISOString().slice(0, 16) : "";
}

/** «24/11/2026 00:00» en hora de Lima. */
export function limaDateTimeText(iso: string | null): string {
  const local = limaLocalFromIso(iso);
  if (!local) return "";
  const [date, time] = local.split("T");
  return `${date.split("-").reverse().join("/")} ${time}`;
}

/** Productos de la campaña: todos o los elegidos. */
export function campaignIncludes(promo: { allProducts: boolean; products: Array<{ productId: string }> }, productId: string): boolean {
  return promo.allProducts || promo.products.some((product) => product.productId === productId);
}

/** La campaña aplica en esta tienda (sin tiendas = todas). */
export function campaignInStore(promo: { storeIds: string[] }, storeId: string | null | undefined): boolean {
  return !promo.storeIds.length || (!!storeId && promo.storeIds.includes(storeId));
}

/** Descuento que usa un producto: el propio si tiene, si no el general. */
export function productDiscount(
  promo: { discountType: DiscountKind | null; discountValue: number | null; products: Array<{ productId: string; discountType: DiscountKind | null; discountValue: number | null }> },
  productId: string,
): Discount {
  const own = promo.products.find((product) => product.productId === productId);
  return own?.discountType ? { type: own.discountType, value: own.discountValue } : { type: promo.discountType, value: promo.discountValue };
}

/** Precio con la campaña de una variante en un canal (`null` = queda en 0 o menos: la venta no lo aplica). */
export function promoPriceFor(
  promo: {
    discountType: DiscountKind | null;
    discountValue: number | null;
    products: Array<{ productId: string; discountType: DiscountKind | null; discountValue: number | null }>;
    manualPrices: Array<{ productId: string; channel: string; price: number }>;
  },
  productId: string,
  channel: string,
  base: number,
): number | null {
  const manual = promo.manualPrices.find((row) => row.productId === productId && row.channel === channel)?.price ?? null;
  const own = promo.products.find((product) => product.productId === productId);
  const price = campaignPrice({
    base,
    general: { type: promo.discountType, value: promo.discountValue },
    own: own?.discountType ? { type: own.discountType, value: own.discountValue } : null,
    manual,
  });
  return price > 0 ? price : null;
}

/** «12,5» → 12.5; vacío → null; texto inválido → NaN. */
export function parseMoneyInput(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? round2(value) : Number.NaN;
}

// ---------------------------------------------------------------------------------------------------------
// FEAT-32 M3 — campañas de un producto en la ficha, la lista de productos y Listas de precios (§7.1, §7.8, §7.10).

export interface CampaignLike {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  storeIds: string[];
  channels: string[];
  allProducts: boolean;
  discountType: DiscountKind | null;
  discountValue: number | null;
  products: Array<{ productId: string; discountType: DiscountKind | null; discountValue: number | null }>;
  manualPrices: Array<{ productId: string; channel: string; price: number }>;
}

/** La campaña aplica en alguna de estas tiendas (sin tiendas en la campaña o en el alcance = sí). */
export function campaignInStores(promo: { storeIds: string[] }, storeIds: string[]): boolean {
  return !promo.storeIds.length || !storeIds.length || storeIds.some((id) => promo.storeIds.includes(id));
}

/** Campañas que incluyen el producto en esas tiendas, en orden: activas, programadas, pausadas, terminadas. */
export function productCampaigns<T extends CampaignLike>(promos: T[], productId: string, storeIds: string[], now: Date = new Date()): T[] {
  const order: Record<PromoStatus, number> = { ACTIVE: 0, SCHEDULED: 1, PAUSED: 2, ENDED: 3 };
  return promos
    .filter((promo) => promo.type === "CAMPAIGN" && campaignIncludes(promo, productId) && campaignInStores(promo, storeIds))
    .map((promo) => ({ promo, status: promoStatus(promo, now) }))
    .sort((a, b) => order[a.status] - order[b.status] || String(a.promo.startsAt).localeCompare(String(b.promo.startsAt)))
    .map(({ promo }) => promo);
}

/** Campaña activa ahora para el producto en ese canal (no hay dos: el servidor rechaza los cruces). */
export function activeCampaign<T extends CampaignLike>(promos: T[], productId: string, storeIds: string[], channel: string, now: Date = new Date()): T | null {
  return productCampaigns(promos, productId, storeIds, now).find((promo) => promo.channels.includes(channel) && promoStatus(promo, now) === "ACTIVE") ?? null;
}

/** La próxima campaña programada para el producto en ese canal. */
export function nextCampaign<T extends CampaignLike>(promos: T[], productId: string, storeIds: string[], channel: string, now: Date = new Date()): T | null {
  return productCampaigns(promos, productId, storeIds, now).find((promo) => promo.channels.includes(channel) && promoStatus(promo, now) === "SCHEDULED") ?? null;
}

/** «Cyber Wow −20%» o «Precio especial del chat Precio final S/ 129.00 · precio ajustado». */
export function campaignTag(promo: CampaignLike, productId: string): string {
  const adjusted = promo.manualPrices.some((row) => row.productId === productId);
  return `${promo.name} ${discountLabel(productDiscount(promo, productId))}${adjusted ? " · precio ajustado" : ""}`;
}

/** «24/11» o «24/11 18:00» (hora de Lima; sin la hora si es medianoche). */
export function limaShortDate(iso: string | null): string {
  const local = limaLocalFromIso(iso);
  if (!local) return "";
  const [date, time] = local.split("T");
  const [, month, day] = date.split("-");
  return time === "00:00" ? `${day}/${month}` : `${day}/${month} ${time}`;
}
