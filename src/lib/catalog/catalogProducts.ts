/**
 * FEAT-24 H4 (H4-D5/D7/D11) — listado del catálogo: canal, tipo, variantes vivas y filtros.
 * Lógica pura sobre lo que devuelve `GET /products/report` (ms-products).
 */
import { visibleVariantAttributes } from "@/lib/variantAttributes";
import { descendantIds, type CatalogCategoryNode } from "./categoryTree";

export type ProductChannel = "manual" | "shopify" | "yavendio" | "aliclik";
export type ProductKind = "simple" | "variantes" | "pack";

export const CHANNEL_LABEL: Record<ProductChannel, string> = {
  manual: "Manual",
  shopify: "Shopify",
  yavendio: "YaVendió",
  aliclik: "Aliclik",
};

export const KIND_LABEL: Record<ProductKind, string> = {
  simple: "Simple",
  variantes: "Con variantes",
  pack: "Pack",
};

/** Variante tal como llega en el listado o en `by-product` (todo opcional: backends viejos no traen todo). */
export interface CatalogVariantLike {
  id: string;
  status?: boolean;
  isActive?: boolean;
  mergedInto?: string | null;
  attributeValues?: Record<string, unknown> | null;
  companySku?: string | null;
  skuConflict?: boolean;
}

export interface CatalogProductLike {
  id: string;
  name: string;
  sku?: string;
  companySku?: string | null;
  status?: boolean;
  brandId?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  type?: string | null;
  externalSource?: string | null;
  variants?: CatalogVariantLike[];
}

/** Canal de origen: `external_source` (Shopify, YaVendió, Aliclik); sin él, alta manual en POWIP. */
export function productChannel(externalSource: string | null | undefined): ProductChannel {
  const source = String(externalSource ?? "").trim().toLowerCase();
  if (source === "shopify" || source === "yavendio" || source === "aliclik") return source;
  return "manual";
}

export const isLiveVariant = (variant: CatalogVariantLike) =>
  variant.isActive !== false && variant.status !== false && !variant.mergedInto;

export function liveVariants<T extends CatalogVariantLike>(variants: T[] | null | undefined): T[] {
  return (variants ?? []).filter(isLiveVariant);
}

/**
 * Tipo del producto (H4-D7). Si el backend todavía no manda `type`: una sola variante viva sin
 * opciones reales (o «Default Title») es simple.
 */
export function productKind(product: CatalogProductLike): ProductKind {
  if (product.type === "simple" || product.type === "variantes" || product.type === "pack") return product.type;
  const live = liveVariants(product.variants);
  if (live.length <= 1 && live.every((variant) => visibleVariantAttributes(variant.attributeValues as Record<string, unknown>).length === 0)) {
    return "simple";
  }
  return "variantes";
}

export const isSimpleProduct = (product: CatalogProductLike) => productKind(product) === "simple";

/** SKU que ve el comercio: el de la empresa; si falta, el interno. */
export const visibleProductSku = (product: Pick<CatalogProductLike, "companySku" | "sku">) =>
  product.companySku?.trim() || product.sku || "";

export const hasSkuConflict = (product: CatalogProductLike) => liveVariants(product.variants).some((variant) => variant.skuConflict);

export interface CatalogFilters {
  search: string;
  /** "all", "none" (sin marca) o el id. */
  brandId: string;
  /** "all", "none" (sin categoría) o el id (incluye sus subcategorías). */
  categoryId: string;
  channel: "all" | ProductChannel;
  type: "all" | ProductKind;
  status: "all" | "activo" | "inactivo";
  stock: "all" | "con" | "sin";
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  search: "",
  brandId: "all",
  categoryId: "all",
  channel: "all",
  type: "all",
  status: "all",
  stock: "all",
};

export function hasActiveCatalogFilters(filters: CatalogFilters): boolean {
  return (Object.keys(DEFAULT_CATALOG_FILTERS) as Array<keyof CatalogFilters>).some((key) => filters[key] !== DEFAULT_CATALOG_FILTERS[key]);
}

const fold = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

/** Filtros del listado (spec §6.1): búsqueda, marca, categoría (con su rama), canal, tipo, estado y con/sin stock. */
export function filterCatalogProducts<T extends CatalogProductLike>(
  products: T[],
  filters: CatalogFilters,
  context: { categoryTree?: CatalogCategoryNode[]; availableByProduct?: Map<string, number> } = {},
): T[] {
  const query = fold(filters.search.trim());
  const branch = filters.categoryId !== "all" && filters.categoryId !== "none"
    ? new Set(descendantIds(context.categoryTree ?? [], filters.categoryId).concat(filters.categoryId))
    : null;
  return products.filter((product) => {
    const categoryId = product.categoryId ?? product.category?.id ?? null;
    if (query && ![product.name, product.companySku, product.sku, ...(product.variants ?? []).map((variant) => variant.companySku)]
      .some((value) => fold(value).includes(query))) return false;
    if (filters.brandId === "none" ? Boolean(product.brandId) : filters.brandId !== "all" && product.brandId !== filters.brandId) return false;
    if (filters.categoryId === "none" ? Boolean(categoryId) : branch && (!categoryId || !branch.has(categoryId))) return false;
    if (filters.channel !== "all" && productChannel(product.externalSource) !== filters.channel) return false;
    if (filters.type !== "all" && productKind(product) !== filters.type) return false;
    if (filters.status === "activo" && product.status === false) return false;
    if (filters.status === "inactivo" && product.status !== false) return false;
    if (filters.stock !== "all") {
      const available = context.availableByProduct?.get(product.id) ?? 0;
      if (filters.stock === "con" ? available <= 0 : available > 0) return false;
    }
    return true;
  });
}
