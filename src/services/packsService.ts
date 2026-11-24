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

/** FEAT-32 M5 — FIXED: variantes definidas; CHOOSE: el cliente elige talla y color (no se vende hasta M6). */
export type PackType = "FIXED" | "CHOOSE";
/** Solo packs de creadoras (POWIP Live); `null` = pack del negocio. */
export type PackApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

/** El componente que limita el disponible: FIXED «Blusa Sofía M crema»; CHOOSE el nombre del producto. */
export interface PackLimiting {
  productId: string;
  variantId: string | null;
  label: string;
}

/** Componente de un pack «a elegir»: una lista de variantes permitidas con la misma cantidad. */
export interface PackChoiceComponentView {
  slot: number;
  productId: string;
  productName: string;
  quantity: number;
  variants: Array<{ variantId: string; sku: string | null; attributeValues: Record<string, string>; active: boolean; imageUrl: string | null }>;
}

export interface PackWarehouseAvailability {
  inventoryId: string;
  inventoryName: string | null;
  storeId: string | null;
  available: number;
  limiting?: PackLimiting | null;
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
  /** FIXED; `[]` en CHOOSE. */
  components: PackComponentView[];
  /**
   * FEAT-32 M5: opcionales para no romper con un ms-products anterior (sin ellos el pack es FIXED y del negocio).
   */
  packType?: PackType;
  approvalStatus?: PackApprovalStatus | null;
  creatorId?: string | null;
  /** CHOOSE; `[]` en FIXED. */
  choiceComponents?: PackChoiceComponentView[];
  /** Σ precio × cantidad de los componentes (CHOOSE: el mayor precio de las permitidas). */
  componentsTotal?: number | null;
  /** Disponible = mín(disponible del componente ÷ cantidad) por almacén; `null` si logística no respondió. */
  available: { total: number; byWarehouse: PackWarehouseAvailability[]; limiting?: PackLimiting | null } | null;
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
  /** `pendingCount`: packs de creadora pendientes de la empresa, sin importar los filtros. */
  meta: { page: number; limit: number; total: number; totalPages: number; pendingCount?: number };
}

export interface PackComponentInput {
  variantId: string;
  quantity: number;
}

/** Componente CHOOSE: variantes permitidas del producto (al menos una), todas con la misma cantidad. */
export interface PackChoiceComponentInput {
  productId: string;
  allowedVariantIds: string[];
  quantity: number;
}

export interface CreatePackBody {
  name: string;
  price: number;
  /** FIXED: `{ variantId, quantity }`; CHOOSE: `{ productId, allowedVariantIds, quantity }`. */
  components: PackComponentInput[] | PackChoiceComponentInput[];
  packType?: PackType;
  description?: string;
  companySku?: string;
  barcode?: string;
  confirmLowMargin?: boolean;
}

/** `PATCH /packs/:id`: si cambia `packType`, `components` es obligatorio (con el formato del tipo nuevo). */
export interface UpdatePackBody {
  name?: string;
  companySku?: string;
  price?: number;
  packType?: PackType;
  components?: PackComponentInput[] | PackChoiceComponentInput[];
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

export interface ListPacksParams {
  q?: string;
  active?: boolean;
  page?: number;
  limit?: number;
  packType?: PackType;
  /** `creators`: solo los packs de creadoras. */
  origin?: "creators";
}

export async function listPacks(params: ListPacksParams = {}, signal?: AbortSignal): Promise<PackPage> {
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
 * FEAT-32 M5 — edita nombre, SKU, precio, tipo y componentes en una sola llamada. El margen se mide con el precio
 * nuevo (409 `PACK_LOW_MARGIN` si queda bajo el mínimo y no viene `confirmLowMargin`).
 */
export async function updatePack(productId: string, body: UpdatePackBody): Promise<PackView> {
  const { data } = await axiosAuth.patch<PackView>(`${products()}/packs/${encodeURIComponent(productId)}`, body);
  return data;
}

/** FEAT-32 M5 — aprueba (se vende y se publica) o rechaza un pack de creadora. */
export async function setPackApproval(productId: string, decision: "APPROVED" | "REJECTED"): Promise<PackView> {
  const { data } = await axiosAuth.post<PackView>(`${products()}/packs/${encodeURIComponent(productId)}/approval`, { decision });
  return data;
}

/** Tipo del pack; sin el dato (ms-products anterior) es FIXED. */
export const packTypeOf = (pack: Pick<PackView, "packType">): PackType => (pack.packType === "CHOOSE" ? "CHOOSE" : "FIXED");

/** Se vende: FIXED y del negocio o de creadora aprobado (CHOOSE se vende desde M6). */
export const packSellable = (pack: Pick<PackView, "packType" | "approvalStatus">): boolean =>
  packTypeOf(pack) === "FIXED" && (pack.approvalStatus == null || pack.approvalStatus === "APPROVED");

/** Cuántos componentes tiene (FIXED: variantes; CHOOSE: productos con sus permitidas). */
export const packComponentCount = (pack: Pick<PackView, "packType" | "components" | "choiceComponents">): number =>
  packTypeOf(pack) === "CHOOSE" ? (pack.choiceComponents ?? []).length : pack.components.length;

/** Producto que puede ser componente: activo, no pack y sin IMEI/serie (lo mismo valida el backend). */
export interface PackComponentProduct {
  id: string;
  name: string;
  sku: string;
  companySku: string | null;
  imageUrl: string | null;
}

const textOrNull = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);

/** Productos de la empresa que pueden ir en un pack (`GET /products/company/:id`). */
export async function listPackComponentProducts(companyId: string, signal?: AbortSignal): Promise<PackComponentProduct[]> {
  if (!companyId) return [];
  const { data } = await axiosAuth.get<unknown[]>(`${products()}/products/company/${encodeURIComponent(companyId)}`, { signal });
  if (!Array.isArray(data)) return [];
  return data
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string")
    .filter((raw) => raw.status !== false && raw.type !== "pack" && (!raw.trackingMode || raw.trackingMode === "NONE"))
    .map((raw) => ({
      id: raw.id as string,
      name: textOrNull(raw.name) ?? "Producto sin nombre",
      sku: textOrNull(raw.sku) ?? "",
      companySku: textOrNull(raw.companySku),
      imageUrl: textOrNull(raw.imageUrl),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Variante de un producto para la ventana del pack: SKU, atributos y precio de venta. */
export interface PackProductVariant {
  id: string;
  sku: string | null;
  attributeValues: Record<string, string>;
  price: number | null;
  active: boolean;
}

/** Variantes vivas de un producto (`GET /product-variant/by-product/:id`; sin las unificadas). */
export async function listPackProductVariants(productId: string, signal?: AbortSignal): Promise<PackProductVariant[]> {
  const { data } = await axiosAuth.get<unknown[]>(`${products()}/product-variant/by-product/${encodeURIComponent(productId)}`, { signal });
  if (!Array.isArray(data)) return [];
  return data
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string")
    .filter((raw) => !textOrNull(raw.mergedInto))
    .map((raw) => {
      const price = Number(raw.priceVta);
      return {
        id: raw.id as string,
        sku: textOrNull(raw.companySku) ?? textOrNull(raw.sku),
        attributeValues: raw.attributeValues && typeof raw.attributeValues === "object" ? (raw.attributeValues as Record<string, string>) : {},
        price: raw.priceVta === null || raw.priceVta === undefined || !Number.isFinite(price) ? null : price,
        active: raw.isActive !== false,
      };
    });
}

/** Todos los packs de la empresa: recorre las páginas de 100 con un tope de 20 (2000 packs). */
export async function listAllPacks(params: { active?: boolean } = {}, signal?: AbortSignal): Promise<PackView[]> {
  const packs: PackView[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await listPacks({ ...params, page, limit: 100 }, signal);
    packs.push(...result.data);
    if (page >= result.meta.totalPages || result.data.length === 0) break;
  }
  return packs;
}

/** Ids de producto y de variante de todos los packs de la empresa (para ocultarlos donde no se venden, p. ej. Live). */
export async function listPackProductIds(signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>();
  (await listAllPacks({}, signal)).forEach((pack) => {
    ids.add(pack.id);
    if (pack.variantId) ids.add(pack.variantId);
  });
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
