import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/**
 * FEAT-24 H9 (H9-D1/D3) — packs de ms-products (fachada con JWT; la empresa sale del token).
 * Leer: cualquier usuario de la empresa. Escribir: Administrador u Operaciones. Costo y margen solo
 * llegan a quien puede ver costos (para el resto esas claves no vienen).
 */
const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export type PackMarginStatus = "ok" | "bajo_minimo" | "bajo_costo" | "sin_costo" | "sin_precio" | "no_disponible";

export interface PackComponentView {
  variantId: string;
  quantity: number;
  productId: string;
  productName: string;
  sku: string | null;
  attributeValues: Record<string, string>;
  imageUrl: string | null;
  active: boolean;
  /** Solo con permiso de costos. */
  averageCost?: number | null;
}

export interface PackWarehouseAvailability {
  inventoryId: string;
  inventoryName: string | null;
  storeId: string | null;
  available: number;
}

export interface PackView {
  id: string;
  variantId: string;
  name: string;
  description: string | null;
  sku: string | null;
  productSku: string | null;
  powipEan: string | null;
  barcode: string | null;
  imageUrl: string | null;
  price: number;
  active: boolean;
  categoryId: string | null;
  brandId: string | null;
  components: PackComponentView[];
  /** Disponible = mín(disponible del componente ÷ cantidad) por almacén; `null` si logística no respondió. */
  available: { total: number; byWarehouse: PackWarehouseAvailability[] } | null;
  cost?: number | null;
  netPrice?: number;
  igvAffected?: boolean;
  margin?: number | null;
  minMargin?: number;
  marginStatus?: PackMarginStatus;
  missingCostVariantIds?: string[];
}

export interface PackPage {
  data: PackView[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PackComponentInput {
  variantId: string;
  quantity: number;
}

export interface CreatePackBody {
  name: string;
  price: number;
  components: PackComponentInput[];
  description?: string;
  companySku?: string;
  barcode?: string;
  confirmLowMargin?: boolean;
}

/** 409 del servidor cuando el margen queda bajo el mínimo (o el precio bajo el costo). */
export interface PackLowMarginConflict {
  code: "PACK_LOW_MARGIN";
  message: string;
  price: number;
  netPrice: number;
  igvAffected: boolean;
  cost: number | null;
  margin: number | null;
  minMargin: number;
  marginStatus: PackMarginStatus;
}

export async function listPacks(
  params: { q?: string; active?: boolean; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<PackPage> {
  const { data } = await axiosAuth.get<PackPage>(`${products()}/packs`, { params, signal });
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta ?? { page: 1, limit: params.limit ?? 50, total: 0, totalPages: 0 },
  };
}

export async function getPack(productId: string, signal?: AbortSignal): Promise<PackView> {
  const { data } = await axiosAuth.get<PackView>(`${products()}/packs/${encodeURIComponent(productId)}`, { signal });
  return data;
}

export async function createPack(body: CreatePackBody): Promise<PackView> {
  const { data } = await axiosAuth.post<PackView>(`${products()}/packs`, body);
  return data;
}

/** Reemplaza la lista entera de componentes (el margen se mide contra el precio guardado del pack). */
export async function replacePackComponents(
  productId: string,
  body: { components: PackComponentInput[]; confirmLowMargin?: boolean },
): Promise<PackView> {
  const { data } = await axiosAuth.put<PackView>(`${products()}/packs/${encodeURIComponent(productId)}/components`, body);
  return data;
}

/**
 * Nombre y precio del pack: es un producto con una variante, así que van por las rutas del catálogo
 * (`PATCH /products/:id` y `PATCH /product-variant/:id` con `priceVta`). El margen no se valida acá: lo
 * mide el `PUT .../components` que se manda después.
 */
export async function updatePackBasics(pack: Pick<PackView, "id" | "variantId">, patch: { name?: string; price?: number }) {
  if (patch.name !== undefined) {
    await axiosAuth.patch(`${products()}/products/${encodeURIComponent(pack.id)}`, { name: patch.name });
  }
  if (patch.price !== undefined) {
    await axiosAuth.patch(`${products()}/product-variant/${encodeURIComponent(pack.variantId)}`, { priceVta: patch.price });
  }
}

/**
 * Ids de producto y de variante de todos los packs de la empresa (para ocultarlos donde no se venden,
 * p. ej. Live). Recorre las páginas de 100 con un tope de 20 (2000 packs).
 */
export async function listPackProductIds(signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let page = 1; page <= 20; page += 1) {
    const result = await listPacks({ page, limit: 100 }, signal);
    result.data.forEach((pack) => {
      ids.add(pack.id);
      if (pack.variantId) ids.add(pack.variantId);
    });
    if (page >= result.meta.totalPages || result.data.length === 0) break;
  }
  return ids;
}

/** Saca los packs de una lista de productos (por producto o, si falta, por variante). */
export function withoutPacks<T extends { productId?: string | null; variantId?: string | null }>(products: readonly T[], packIds: ReadonlySet<string>): T[] {
  if (packIds.size === 0) return [...products];
  return products.filter((product) => !(product.productId && packIds.has(product.productId)) && !(product.variantId && packIds.has(product.variantId)));
}

/** Reglas de inventario que usa el margen del pack (`GET /warehouses/inventory-rules`). */
export interface PackMarginRules {
  minMargin: number;
  igvAffected: boolean;
}

/** Margen mínimo por defecto del backend si la empresa no fijó `packMinMargin`. */
export const DEFAULT_PACK_MIN_MARGIN = 0.15;

function normalizeMinMargin(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

export async function getPackMarginRules(signal?: AbortSignal): Promise<PackMarginRules> {
  const { data } = await axiosAuth.get<Record<string, unknown>>(`${products()}/warehouses/inventory-rules`, { signal });
  return {
    minMargin: normalizeMinMargin(data?.packMinMargin) ?? DEFAULT_PACK_MIN_MARGIN,
    igvAffected: data?.igvAffected !== false,
  };
}

/**
 * Cambia solo el margen mínimo de los packs (solo Administrador). El PUT de reglas exige las dos reglas de
 * stock, así que se leen primero y se reenvían tal cual.
 */
export async function savePackMinMargin(minMargin: number): Promise<PackMarginRules> {
  const { data: current } = await axiosAuth.get<Record<string, unknown>>(`${products()}/warehouses/inventory-rules`);
  const { data } = await axiosAuth.put<Record<string, unknown>>(`${products()}/warehouses/inventory-rules`, {
    releaseAfterDays: current?.releaseAfterDays ?? null,
    pickingRequired: current?.pickingRequired === true,
    packMinMargin: minMargin,
  });
  return {
    minMargin: normalizeMinMargin(data?.packMinMargin) ?? minMargin,
    igvAffected: data?.igvAffected !== false,
  };
}

/** Precio de venta (`priceVta`) de variantes por id; descarta las de otra empresa. */
export async function getVariantSalePrices(ids: string[], companyId: string): Promise<Map<string, number>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const prices = new Map<string, number>();
  if (!unique.length || !companyId) return prices;
  const { data } = await axiosAuth.post<Array<Record<string, unknown>>>(`${products()}/product-variant/multiple/by-ids`, { ids: unique });
  for (const raw of Array.isArray(data) ? data : []) {
    const product = raw?.product as { companyId?: unknown } | undefined;
    if (typeof raw?.id !== "string" || product?.companyId !== companyId) continue;
    const price = Number(raw.priceVta);
    if (Number.isFinite(price)) prices.set(raw.id, price);
  }
  return prices;
}
