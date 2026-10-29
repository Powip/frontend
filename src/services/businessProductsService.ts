import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { BusinessInventoryItem } from "./businessInventoryItemsService";

export interface BusinessProduct {
  id: string;
  companyId: string;
  name: string;
  sku: string;
  companySku?: string;
  status: boolean;
  priceVta: number;
  variants?: Array<{ id: string; status?: boolean }>;
}
export async function fetchBusinessProducts({ companyId, accessToken, signal }: { companyId: string; accessToken: string; signal?: AbortSignal }): Promise<BusinessProduct[]> {
  const { data } = await axiosAuth.get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/products/report`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  if (!Array.isArray(data?.data) || data.data.some((product: BusinessProduct) => !product?.id || product.companyId !== companyId || typeof product.name !== "string")) {
    throw new Error("El catálogo no corresponde al negocio activo.");
  }
  return [...new Map<string, BusinessProduct>(data.data.map((product: BusinessProduct) => [product.id, product])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
}

export function scopeBusinessProducts(products: BusinessProduct[], rows: BusinessInventoryItem[], scope: "business" | "store", search: string) {
  const inventoryProductIds = new Set(rows.map((row) => row.productId));
  const query = search.trim().toLocaleLowerCase("es");
  return products.filter((product) => (scope === "business" || inventoryProductIds.has(product.id)) &&
    (!query || [product.name, product.sku, product.companySku].some((value) => String(value ?? "").toLocaleLowerCase("es").includes(query))));
}
