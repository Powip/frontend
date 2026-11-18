import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/**
 * FEAT-24 H9 (H9-D6) — listas de precios de ms-products (JWT, empresa del token). Leer: cualquiera;
 * escribir: solo el Administrador. Las listas guardan solo excepciones: sin precio propio la variante
 * hereda (`priceVta`). No se publica nada a Shopify.
 */
const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export interface PriceList {
  id: string;
  name: string;
  storeId: string | null;
  channel: string | null;
  isDefault: boolean;
  active: boolean;
  itemCount: number;
}

export interface PriceListItem {
  variantId: string;
  productId: string;
  productName: string;
  productType: string | null;
  companySku: string | null;
  attributeValues: Record<string, string>;
  imageUrl: string | null;
  /** `priceVta` de la variante (lo que se cobra si la lista no tiene precio propio). */
  inheritedPrice: number;
  inList: boolean;
  price: number | null;
  compareAtPrice: number | null;
  effectivePrice: number;
}

export interface PriceListItemsPage {
  list: PriceList;
  data: PriceListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Un número fija el precio propio; `price: null` lo quita (vuelve a heredar). Sin `compareAtPrice` no se toca. */
export interface PriceItemWrite {
  variantId: string;
  price: number | null;
  compareAtPrice?: number | null;
}

export async function listPriceLists(signal?: AbortSignal): Promise<PriceList[]> {
  const { data } = await axiosAuth.get<PriceList[]>(`${products()}/price-lists`, { params: { active: true }, signal });
  return Array.isArray(data) ? data : [];
}

export async function createPriceList(body: { name: string; storeId: string; channel?: string; copyFromListId?: string }): Promise<PriceList> {
  const { data } = await axiosAuth.post<PriceList>(`${products()}/price-lists`, body);
  return data;
}

export async function getPriceListItems(
  listId: string,
  params: { q?: string; onlyInList?: boolean; page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<PriceListItemsPage> {
  const { data } = await axiosAuth.get<PriceListItemsPage>(`${products()}/price-lists/${encodeURIComponent(listId)}/items`, {
    params: { ...params, q: params.q?.trim() || undefined, onlyInList: params.onlyInList || undefined },
    signal,
  });
  return data;
}

export async function savePriceListItems(
  listId: string,
  items: PriceItemWrite[],
): Promise<{ created: number; updated: number; unchanged: number; removed: number }> {
  const { data } = await axiosAuth.put(`${products()}/price-lists/${encodeURIComponent(listId)}/items`, { items });
  return data;
}
