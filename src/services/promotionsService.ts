import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/**
 * FEAT-24 H9 (H9-D5/D6) — promociones VOLUME y GIFT (`/promos`, JWT; la empresa sale del token) y el
 * precio por lista para la venta manual (`/prices/resolve`). Cuelgan de ms-ventas.
 */
const ventas = () => process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;

export type PromoKind = "VOLUME" | "GIFT";
export type GiftCondition = "AMOUNT" | "PRODUCT" | "VARIANT";

export interface Promotion {
  id: string;
  name: string;
  type: PromoKind;
  isActive: boolean;
  /** Canales del pedido (`salesChannel`); vacío = todos. */
  channels: string[];
  /** Tiendas; vacío = todas. */
  storeIds: string[];
  startsAt: string | null;
  /** Exclusivo. */
  endsAt: string | null;
  productId: string | null;
  minQty: number | null;
  maxQty: number | null;
  packPrice: number | null;
  giftCondition: GiftCondition | null;
  minAmount: number | null;
  triggerVariantId: string | null;
  giftVariantId: string | null;
  giftQuantity: number | null;
}

export interface PromotionBody {
  name: string;
  type: PromoKind;
  channels: string[];
  storeIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  productId?: string;
  minQty?: number;
  maxQty?: number;
  packPrice?: number;
  giftCondition?: GiftCondition;
  minAmount?: number;
  triggerVariantId?: string;
  giftVariantId?: string;
  giftQuantity?: number;
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/** Normaliza una fila de `/promos` (los decimales llegan como texto). */
export function toPromotion(raw: Record<string, unknown>): Promotion {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    type: raw.type === "GIFT" ? "GIFT" : "VOLUME",
    isActive: raw.isActive !== false,
    channels: Array.isArray(raw.channels) ? raw.channels.filter((c): c is string => typeof c === "string") : [],
    storeIds: Array.isArray(raw.storeIds) ? raw.storeIds.filter((s): s is string => typeof s === "string") : [],
    startsAt: str(raw.startsAt),
    endsAt: str(raw.endsAt),
    productId: str(raw.productId),
    minQty: num(raw.minQty),
    maxQty: num(raw.maxQty),
    packPrice: num(raw.packPrice),
    giftCondition: raw.giftCondition === "AMOUNT" || raw.giftCondition === "PRODUCT" || raw.giftCondition === "VARIANT" ? raw.giftCondition : null,
    minAmount: num(raw.minAmount),
    triggerVariantId: str(raw.triggerVariantId),
    giftVariantId: str(raw.giftVariantId),
    giftQuantity: num(raw.giftQuantity),
  };
}

/** VOLUME y GIFT de la empresa (BUNDLE vive en `/bundle-promos`). */
export async function listPromotions(signal?: AbortSignal): Promise<Promotion[]> {
  const { data } = await axiosAuth.get<unknown[]>(`${ventas()}/promos`, { signal });
  return (Array.isArray(data) ? data : [])
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
    .filter((raw) => raw.type === "VOLUME" || raw.type === "GIFT")
    .map(toPromotion);
}

export async function createPromotion(body: PromotionBody): Promise<Promotion> {
  const { data } = await axiosAuth.post<Record<string, unknown>>(`${ventas()}/promos`, body);
  return toPromotion(data ?? {});
}

export async function updatePromotion(id: string, body: Partial<PromotionBody> & { isActive?: boolean }): Promise<void> {
  await axiosAuth.patch(`${ventas()}/promos/${encodeURIComponent(id)}`, body);
}

export async function deletePromotion(id: string): Promise<void> {
  await axiosAuth.delete(`${ventas()}/promos/${encodeURIComponent(id)}`);
}

export interface EvaluatedGift {
  promoId: string;
  name: string;
  variantId: string;
  quantity: number;
  sku: string;
  productName: string;
  giftValue: number | null;
}

export interface EvaluateItem {
  productVariantId: string;
  quantity: number;
  unitPrice?: number;
  discountAmount?: number;
  isGift?: boolean;
}

/** Regalos (GIFT) que aplican al carrito. La venta manual los suma sola al guardarse. */
export async function evaluatePromotions(
  body: { storeId: string; channel?: string; items: EvaluateItem[] },
  signal?: AbortSignal,
): Promise<{ gifts: EvaluatedGift[] }> {
  const { data } = await axiosAuth.post<{ gifts?: EvaluatedGift[] }>(`${ventas()}/promos/evaluate`, body, { signal });
  return { gifts: Array.isArray(data?.gifts) ? data.gifts : [] };
}

export interface ResolvedPrice {
  variantId: string;
  price: number;
  compareAtPrice: number | null;
  listId: string | null;
}

/** Precio de cada variante según la lista de la tienda y el canal (`[]` si ms-products no responde). */
export async function resolvePrices(
  body: { storeId?: string; channel?: string; variantIds: string[] },
  signal?: AbortSignal,
): Promise<ResolvedPrice[]> {
  if (!body.variantIds.length) return [];
  const { data } = await axiosAuth.post<ResolvedPrice[]>(`${ventas()}/prices/resolve`, body, { signal });
  return (Array.isArray(data) ? data : [])
    .map((row) => ({ ...row, price: Number(row.price), compareAtPrice: num(row.compareAtPrice) }))
    .filter((row) => typeof row.variantId === "string" && Number.isFinite(row.price));
}
