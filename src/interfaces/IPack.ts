/* -----------------------------------------
   Packs & Promos
   Feature solo-UI: vive en el frontend (PacksContext + localStorage).
   No tiene backend propio todavía — cuando exista, este archivo mapea
   1:1 a lo que habría que persistir.
----------------------------------------- */

export type PackType = "VOLUME" | "BUNDLE" | "GIFT";

export interface PackProductRef {
  /** Identificador estable del producto (usamos productName agrupado) */
  productKey: string;
  productName: string;
  price: number;
}

export interface VolumePack {
  id: string;
  type: "VOLUME";
  name: string;
  active: boolean;
  channels: string[];
  product: PackProductRef;
  /** Si es true, el vendedor elige libremente las variantes (PVS) al aplicar */
  variantFree: boolean;
  minQty: number;
  maxQty?: number | null;
  packPrice: number;
}

export interface BundlePack {
  id: string;
  type: "BUNDLE";
  name: string;
  active: boolean;
  channels: string[];
  items: PackProductRef[]; // mínimo 2
  packPrice: number;
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
  channels: string[];
  triggerBy: "amount" | "qty";
  minAmount?: number | null;
  minQty?: number | null;
  gifts: GiftOption[]; // mínimo 2
}

export type Pack = VolumePack | BundlePack | GiftPack;

/** Estado de un pack aplicado en el carrito actual (solo en memoria de la venta) */
export interface AppliedPack {
  type: PackType;
  giftProductKey?: string;
}
