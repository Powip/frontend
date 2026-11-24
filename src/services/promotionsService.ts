import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { promoStatus, type DiscountKind, type PromoStatus } from "@/lib/promotions/campaign";

/**
 * FEAT-24 H9 (H9-D5/D6) — promociones VOLUME y GIFT (`/promos`, JWT; la empresa sale del token) y el
 * precio por lista para la venta manual (`/prices/resolve`). Cuelgan de ms-ventas.
 */
const ventas = () => process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;

/** FEAT-32 M3: `CAMPAIGN` = precio de campaña. */
export type PromoKind = "VOLUME" | "GIFT" | "CAMPAIGN";
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
  /** FEAT-32 M4 — VOLUME: SKUs cuyas unidades se cuentan juntas (una fila vieja puede no mandarlo: `[]`). */
  variantIds: string[];
  minQty: number | null;
  maxQty: number | null;
  packPrice: number | null;
  giftCondition: GiftCondition | null;
  minAmount: number | null;
  triggerVariantId: string | null;
  giftVariantId: string | null;
  giftQuantity: number | null;
  /** FEAT-32 M3 — estado calculado (el del servidor o, si no vino, el del navegador). */
  status: PromoStatus;
  combinable: boolean;
  /** CAMPAIGN: descuento general. */
  discountType: DiscountKind | null;
  discountValue: number | null;
  allProducts: boolean;
  products: CampaignProduct[];
  manualPrices: CampaignManualPrice[];
}

export interface CampaignProduct {
  productId: string;
  /** Descuento propio; `null` = usa el general. */
  discountType: DiscountKind | null;
  discountValue: number | null;
}

export interface CampaignManualPrice {
  productId: string;
  channel: string;
  price: number;
}

/** FEAT-32 M3 — cuerpo de una campaña (`type: "CAMPAIGN"`). */
export interface CampaignBody {
  name: string;
  type: "CAMPAIGN";
  channels: string[];
  storeIds: string[];
  startsAt: string;
  endsAt: string;
  discountType: DiscountKind;
  discountValue: number;
  allProducts: boolean;
  products: Array<{ productId: string; discountType?: DiscountKind; discountValue?: number }>;
  manualPrices: CampaignManualPrice[];
  combinable: boolean;
}

export interface PromotionBody {
  name: string;
  type: PromoKind;
  channels: string[];
  storeIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  productId?: string;
  /** FEAT-32 M4 — VOLUME: SKUs que cuentan (1..500). En PATCH reemplaza la lista. */
  variantIds?: string[];
  minQty?: number;
  /** `null` = sin tope (en PATCH lo quita). */
  maxQty?: number | null;
  packPrice?: number;
  giftCondition?: GiftCondition;
  minAmount?: number;
  triggerVariantId?: string;
  giftVariantId?: string;
  giftQuantity?: number;
  combinable?: boolean;
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

const DISCOUNTS = ["PERCENT", "AMOUNT", "FINAL"];
const discountKind = (value: unknown): DiscountKind | null => (DISCOUNTS.includes(String(value)) ? (value as DiscountKind) : null);
const STATUSES = ["ACTIVE", "SCHEDULED", "ENDED", "PAUSED"];

/** Normaliza una fila de `/promos` (los decimales llegan como texto). */
export function toPromotion(raw: Record<string, unknown>): Promotion {
  const base = {
    isActive: raw.isActive !== false,
    startsAt: str(raw.startsAt),
    endsAt: str(raw.endsAt),
  };
  const rows = (value: unknown) => (Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : []);
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    type: raw.type === "GIFT" ? "GIFT" : raw.type === "CAMPAIGN" ? "CAMPAIGN" : "VOLUME",
    status: STATUSES.includes(String(raw.status)) ? (raw.status as PromoStatus) : promoStatus(base),
    combinable: raw.combinable === true,
    discountType: discountKind(raw.discountType),
    discountValue: num(raw.discountValue),
    allProducts: raw.allProducts === true,
    products: rows(raw.products)
      .filter((row) => typeof row.productId === "string")
      .map((row) => ({ productId: String(row.productId), discountType: discountKind(row.discountType), discountValue: num(row.discountValue) })),
    manualPrices: rows(raw.manualPrices)
      .filter((row) => typeof row.productId === "string" && typeof row.channel === "string" && num(row.price) !== null)
      .map((row) => ({ productId: String(row.productId), channel: String(row.channel), price: num(row.price) as number })),
    isActive: raw.isActive !== false,
    channels: Array.isArray(raw.channels) ? raw.channels.filter((c): c is string => typeof c === "string") : [],
    storeIds: Array.isArray(raw.storeIds) ? raw.storeIds.filter((s): s is string => typeof s === "string") : [],
    startsAt: str(raw.startsAt),
    endsAt: str(raw.endsAt),
    productId: str(raw.productId),
    variantIds: Array.isArray(raw.variantIds) ? raw.variantIds.filter((id): id is string => typeof id === "string" && id !== "") : [],
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

/** VOLUME, GIFT y (FEAT-32 M3) CAMPAIGN de la empresa (BUNDLE vive en `/bundle-promos`). */
export async function listPromotions(signal?: AbortSignal): Promise<Promotion[]> {
  const { data } = await axiosAuth.get<unknown[]>(`${ventas()}/promos`, { signal });
  return (Array.isArray(data) ? data : [])
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
    .filter((raw) => raw.type === "VOLUME" || raw.type === "GIFT" || raw.type === "CAMPAIGN")
    .map(toPromotion);
}

export async function createPromotion(body: PromotionBody | CampaignBody): Promise<Promotion> {
  const { data } = await axiosAuth.post<Record<string, unknown>>(`${ventas()}/promos`, body);
  return toPromotion(data ?? {});
}

export async function updatePromotion(
  id: string,
  body: (Partial<PromotionBody> | Partial<Omit<CampaignBody, "type">>) & { isActive?: boolean },
): Promise<void> {
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

/** FEAT-32 M6a — línea del motor de promociones (mismo orden que los `items` enviados). */
export interface SaleEngineLine {
  index: number;
  variantId: string;
  quantity: number;
  /** Precio del canal por unidad. */
  listPrice: number;
  /** Neto por unidad con promos (2 decimales). */
  unitPrice: number;
  /** Neto de la línea al céntimo (el que suma en los totales). */
  lineTotal: number;
  promoId: string | null;
  promoIds: string[];
  /** «Cyber Wow», «Volumen: Lleva 3 blusas Sofía a S/ 210». */
  labels: string[];
  isGift: boolean;
}

export type SaleEngineGiftStatus = "GIVEN" | "NOT_SUMMED" | "NO_STOCK";

export interface SaleEngineGift {
  promoId: string;
  name: string;
  variantId: string;
  quantity: number;
  sku: string;
  giftName: string;
  minAmount: number | null;
  /** `GIVEN` = se suma; `NOT_SUMMED` = «no se suma»; `NO_STOCK` = sin stock en el almacén de salida. */
  status: SaleEngineGiftStatus;
}

export interface PackSuggestion {
  kind: "PACK";
  packVariantId: string;
  name: string;
  packPrice: number;
  looseTotal: number;
  /** `null` = el pack no se ofrece (sin SKU no se puede agregar). */
  sku: string | null;
  components: Array<{ variantId: string; quantity: number }>;
  text: string;
}

export interface VolumeSuggestion {
  kind: "VOLUME";
  promoId: string;
  name: string;
  missing: number;
  addVariantId: string;
  unitPrice: number;
  text: string;
}

export interface GiftSuggestion {
  kind: "GIFT";
  promoId: string;
  name: string;
  missingAmount: number;
  giftName: string;
  text: string;
}

export type SaleSuggestion = PackSuggestion | VolumeSuggestion | GiftSuggestion;

/** FEAT-32 M6a — respuesta del motor (`POST /promos/evaluate`) para Registrar venta. */
export interface SaleEngineResult {
  lines: SaleEngineLine[];
  gift: SaleEngineGift | null;
  giftOptions: SaleEngineGift[];
  suggestions: SaleSuggestion[];
  totals: { listSubtotal: number; promoDiscount: number; subtotal: number };
  /** `true` = ms-products no respondió: el precio de lista es el enviado o el del catálogo. */
  priceFallback: boolean;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(record) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : []);
const GIFT_STATUSES: SaleEngineGiftStatus[] = ["GIVEN", "NOT_SUMMED", "NO_STOCK"];

function toEngineGift(raw: Record<string, unknown>): SaleEngineGift | null {
  const status = GIFT_STATUSES.find((value) => value === raw.status);
  if (!status || typeof raw.variantId !== "string") return null;
  return {
    promoId: String(raw.promoId ?? ""),
    name: String(raw.name ?? ""),
    variantId: raw.variantId,
    quantity: num(raw.quantity) ?? 1,
    sku: typeof raw.sku === "string" ? raw.sku : "",
    giftName: String(raw.giftName ?? "Regalo"),
    minAmount: num(raw.minAmount),
    status,
  };
}

function toSuggestion(raw: Record<string, unknown>): SaleSuggestion | null {
  const text = typeof raw.text === "string" ? raw.text : "";
  if (!text) return null;
  if (raw.kind === "PACK" && typeof raw.packVariantId === "string") {
    return {
      kind: "PACK",
      packVariantId: raw.packVariantId,
      name: String(raw.name ?? ""),
      packPrice: num(raw.packPrice) ?? 0,
      looseTotal: num(raw.looseTotal) ?? 0,
      sku: str(raw.sku),
      components: records(raw.components)
        .filter((row) => typeof row.variantId === "string" && (num(row.quantity) ?? 0) > 0)
        .map((row) => ({ variantId: String(row.variantId), quantity: num(row.quantity) as number })),
      text,
    };
  }
  if (raw.kind === "VOLUME") {
    return {
      kind: "VOLUME",
      promoId: String(raw.promoId ?? ""),
      name: String(raw.name ?? ""),
      missing: num(raw.missing) ?? 0,
      addVariantId: String(raw.addVariantId ?? ""),
      unitPrice: num(raw.unitPrice) ?? 0,
      text,
    };
  }
  if (raw.kind === "GIFT") {
    return {
      kind: "GIFT",
      promoId: String(raw.promoId ?? ""),
      name: String(raw.name ?? ""),
      missingAmount: num(raw.missingAmount) ?? 0,
      giftName: String(raw.giftName ?? ""),
      text,
    };
  }
  return null;
}

/** Normaliza la respuesta del motor (un campo ausente o con otra forma queda vacío, nunca rompe la venta). */
export function toSaleEngineResult(data: unknown): SaleEngineResult {
  const raw = record(data) ? data : {};
  const totals = record(raw.totals) ? raw.totals : {};
  return {
    lines: records(raw.lines).map((line, position) => ({
      index: num(line.index) ?? position,
      variantId: String(line.variantId ?? ""),
      quantity: num(line.quantity) ?? 0,
      listPrice: num(line.listPrice) ?? 0,
      unitPrice: num(line.unitPrice) ?? 0,
      lineTotal: num(line.lineTotal) ?? 0,
      promoId: str(line.promoId),
      promoIds: strings(line.promoIds),
      labels: strings(line.labels),
      isGift: line.isGift === true,
    })),
    gift: record(raw.gift) ? toEngineGift(raw.gift) : null,
    giftOptions: records(raw.giftOptions).map(toEngineGift).filter((gift): gift is SaleEngineGift => !!gift),
    suggestions: records(raw.suggestions).map(toSuggestion).filter((item): item is SaleSuggestion => !!item),
    totals: {
      listSubtotal: num(totals.listSubtotal) ?? 0,
      promoDiscount: num(totals.promoDiscount) ?? 0,
      subtotal: num(totals.subtotal) ?? 0,
    },
    priceFallback: raw.priceFallback === true,
  };
}

/**
 * FEAT-32 M6a — motor de promociones de la venta nueva: precio de cada línea, regalo y sugerencias para cerrar.
 * `inventoryId` = almacén de salida (el regalo depende de su stock).
 */
export async function evaluateSaleEngine(
  body: { storeId: string; channel?: string; inventoryId?: string; items: EvaluateItem[] },
  signal?: AbortSignal,
): Promise<SaleEngineResult> {
  const { data } = await axiosAuth.post(`${ventas()}/promos/evaluate`, body, { signal });
  return toSaleEngineResult(data);
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

export interface CampaignPriceVariant {
  variantId: string;
  storePrice: number;
  averageCost: number | null;
  /** Precio del canal (lista + regla del canal) por código. */
  channels: Record<string, number>;
}

export interface CampaignPriceProduct {
  productId: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  variants: CampaignPriceVariant[];
  /** Canales de POWIP apagados para el producto en la tienda: «No activado: no se verá». */
  inactiveChannels: string[];
}

export interface CampaignPrices {
  storeId: string | null;
  igvIncluded: boolean;
  canSeeCosts: boolean;
  /** ms-products no respondió: son los precios base, sin listas ni reglas de canal. */
  fallback: boolean;
  products: CampaignPriceProduct[];
}

/** FEAT-32 M3 — precios de partida (tienda, cada canal y costo) para la ventana de campaña (≤ 200 productos). */
export async function getCampaignPrices(
  body: { storeId?: string; channels: string[]; productIds: string[] },
  signal?: AbortSignal,
): Promise<CampaignPrices> {
  const { data } = await axiosAuth.post<CampaignPrices>(`${ventas()}/promos/campaign-prices`, body, { signal });
  return {
    storeId: data?.storeId ?? null,
    igvIncluded: data?.igvIncluded !== false,
    canSeeCosts: data?.canSeeCosts === true,
    fallback: data?.fallback === true,
    products: Array.isArray(data?.products) ? data.products : [],
  };
}
