import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { ProductPatch, VariantPatch } from "@/lib/catalog/catalogPayloads";
import { parseBulkImportResponse, type BulkImportResponse } from "@/lib/catalog/bulkImportPreview";

/** FEAT-24 H4 — ficha del producto en pestañas (ms-products). */
const base = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export interface CatalogProductDetail {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  sku: string;
  companySku?: string | null;
  skuConflict?: boolean;
  status: boolean;
  type?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string; category?: { id: string; name: string } | null } | null;
  imageUrl?: string | null;
  purchaseUnit?: string | null;
  purchaseFactor?: number | null;
  externalSource?: string | null;
  externalId?: string | null;
  trackingMode?: string | null;
}

export interface CatalogVariantDetail {
  id: string;
  sku: string;
  companySku?: string | null;
  skuConflict?: boolean;
  barcode?: string | null;
  powipEan?: string | null;
  attributeValues: Record<string, string>;
  priceBase?: number | string;
  priceVta?: number | string;
  images?: string[] | null;
  isActive?: boolean;
  mergedInto?: string | null;
  mergedIntoSku?: string | null;
  linkedSources?: string[];
  shopifySku?: string | null;
  externalId?: string | null;
}

/** `GET /products/:id`: el producto tiene que ser de la empresa activa (la ruta no lleva JWT). */
export async function getCatalogProduct(id: string, companyId: string, signal?: AbortSignal): Promise<CatalogProductDetail> {
  const { data } = await axiosAuth.get(`${base()}/products/${encodeURIComponent(id)}`, { signal });
  if (!data?.id || typeof data.name !== "string") throw new Error("No se encontró el producto.");
  if (data.companyId !== companyId) throw new Error("El producto no pertenece al negocio activo.");
  return data as CatalogProductDetail;
}

export async function getProductVariants(productId: string, signal?: AbortSignal): Promise<CatalogVariantDetail[]> {
  const { data } = await axiosAuth.get(`${base()}/product-variant/by-product/${encodeURIComponent(productId)}`, { signal });
  if (!Array.isArray(data)) throw new Error("No se pudieron leer las variantes.");
  return (data as CatalogVariantDetail[]).map((variant) => ({ ...variant, attributeValues: variant.attributeValues ?? {} }));
}

export async function updateCatalogProduct(id: string, patch: ProductPatch) {
  const { data } = await axiosAuth.patch(`${base()}/products/${encodeURIComponent(id)}`, patch);
  return data;
}

export async function updateCatalogVariant(id: string, patch: VariantPatch) {
  const { data } = await axiosAuth.patch(`${base()}/product-variant/${encodeURIComponent(id)}`, patch);
  return data;
}

/** Excel v2 (H4-D9): con `dryRun` el servidor valida y devuelve la vista previa sin escribir nada. */
export async function bulkImportProducts(body: { tenantId?: string; inventoryId: string; rows: Array<Record<string, unknown>> }, options: { dryRun: boolean }): Promise<BulkImportResponse> {
  const url = `${base()}/products/bulk-import${options.dryRun ? "?dryRun=true" : ""}`;
  const { data } = await axiosAuth.post(url, body);
  return parseBulkImportResponse(data);
}
