/* -----------------------------------------
   Packs & Promos

   VOLUME: conectado al backend real (Promos API — ver src/services/promos.service.ts).
   BUNDLE / GIFT: todavía solo-UI (PacksContext + localStorage) — el backend aún
   no confirma su shape. Cuando se confirme, este archivo se actualiza y dejan
   de tener `synced: false`.
----------------------------------------- */

/** Canales soportados por la Promos API real (no coincide 1:1 con SalesChannel de la orden — ver PROMO_CHANNEL_LABEL) */
export type PromoChannel =
  | "SHOPIFY"
  | "WHATSAPP"
  | "TIENDA_FISICA"
  | "RAPPI"
  | "PEDIDOS_YA";

export const PROMO_CHANNELS: PromoChannel[] = [
  "TIENDA_FISICA",
  "WHATSAPP",
  "SHOPIFY",
  "RAPPI",
  "PEDIDOS_YA",
];

export type PackType = "VOLUME" | "BUNDLE" | "GIFT";

export interface PackProductRef {
  /** UUID real de ms-products. Presente en packs sincronizados (VOLUME); puede faltar en Bundle/Gift locales. */
  productId?: string;
  /** Nombre del producto, usado para matchear contra el carrito mientras el buscador de
   *  registrar-venta (inventory-item/search) no exponga productId por variante. */
  productKey: string;
  productName: string;
  price: number;
}

export interface VolumePack {
  id: string;
  companyId?: string;
  type: "VOLUME";
  name: string;
  active: boolean;
  /** string[] a propósito: el motor de evaluación del carrito solo compara texto,
   *  no necesita saber si el canal viene del enum de Promos o del de Órdenes. */
  channels: string[];
  product: PackProductRef;
  /** Si es true, el vendedor elige libremente las variantes (PVS) al aplicar */
  variantFree: boolean;
  minQty: number;
  maxQty?: number | null;
  packPrice: number;
  createdAt?: string;
  updatedAt?: string;
  /** true = viene del backend real (Promos API); false/undefined = todavía solo local */
  synced?: boolean;
}

export interface BundlePack {
  id: string;
  type: "BUNDLE";
  name: string;
  active: boolean;
  /** string[] a propósito: el motor de evaluación del carrito solo compara texto,
   *  no necesita saber si el canal viene del enum de Promos o del de Órdenes. */
  channels: string[];
  items: PackProductRef[]; // mínimo 2
  packPrice: number;
  synced?: boolean;
}

/** Opción de regalo: referencia una variante real de inventario (para poder
 *  incluirla en el pedido con un productVariantId válido al confirmar la venta) */
export interface GiftOption {
  variantId: string;
  inventoryItemId: string;
  sku: string;
  productName: string;
  attributes?: Record<string, string>;
  value: number;
}

export interface GiftPack {
  id: string;
  type: "GIFT";
  name: string;
  active: boolean;
  /** string[] a propósito: el motor de evaluación del carrito solo compara texto,
   *  no necesita saber si el canal viene del enum de Promos o del de Órdenes. */
  channels: string[];
  triggerBy: "amount" | "qty";
  minAmount?: number | null;
  minQty?: number | null;
  gifts: GiftOption[]; // mínimo 2
  synced?: boolean;
}

export type Pack = VolumePack | BundlePack | GiftPack;

/** Estado de un pack aplicado en el carrito actual (solo en memoria de la venta) */
export interface AppliedPack {
  type: PackType;
  giftProductKey?: string;
}
