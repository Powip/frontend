import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H2-F — datos de variantes para Recepciones: nombre y SKU de las líneas
// (por id, el mismo endpoint que usa la edición de productos) y el escaneo
// (SKU, código de fábrica o EAN de POWIP, siempre dentro de la empresa).

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export interface CatalogVariant {
  id: string;
  sku: string;
  companySku: string | null;
  barcode: string | null;
  powipEan: string | null;
  attributeValues: Record<string, string>;
  productName: string;
}

interface RawVariant {
  id?: unknown;
  sku?: unknown;
  companySku?: unknown;
  barcode?: unknown;
  powipEan?: unknown;
  attributeValues?: unknown;
  product?: { name?: unknown; companyId?: unknown } | null;
}

const BY_IDS_CHUNK = 200;
const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);

/**
 * Variantes por id (`POST /product-variant/multiple/by-ids`). Ese endpoint no
 * filtra por empresa: se descartan las que no son de `companyId`.
 */
export async function fetchVariantsByIds(ids: string[], companyId: string): Promise<CatalogVariant[]> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id !== ""))];
  if (unique.length === 0 || !companyId) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BY_IDS_CHUNK) chunks.push(unique.slice(i, i + BY_IDS_CHUNK));
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data } = await axiosAuth.post<RawVariant[]>(`${products()}/product-variant/multiple/by-ids`, { ids: chunk });
      return Array.isArray(data) ? data : [];
    }),
  );
  return pages
    .flat()
    .filter((raw) => typeof raw?.id === "string" && raw.product?.companyId === companyId)
    .map((raw) => ({
      id: raw.id as string,
      sku: text(raw.sku) ?? "",
      companySku: text(raw.companySku),
      barcode: text(raw.barcode),
      powipEan: text(raw.powipEan),
      attributeValues:
        raw.attributeValues && typeof raw.attributeValues === "object"
          ? (raw.attributeValues as Record<string, string>)
          : {},
      productName: text(raw.product?.name) ?? "",
    }));
}

export interface VariantCodeMatch {
  code: string;
  variantId: string;
  sku: string;
  companySku: string | null;
  productId: string;
  productName: string;
  matchedBy?: "sku" | "companySku" | "barcode" | "powipEan";
}

/**
 * Resuelve códigos escaneados (`POST /product-variant/lookup-by-codes` con
 * `includeBarcodes`). Ese endpoint no lee la empresa del token: hay que mandarla.
 */
export async function lookupVariantsByCodes(codes: string[], companyId: string): Promise<VariantCodeMatch[]> {
  const clean = [...new Set(codes.map((code) => code.trim()).filter((code) => code !== ""))];
  if (clean.length === 0 || !companyId) return [];
  const { data } = await axiosAuth.post<VariantCodeMatch[]>(`${products()}/product-variant/lookup-by-codes`, {
    companyId,
    codes: clean,
    includeBarcodes: true,
  });
  return Array.isArray(data) ? data : [];
}
