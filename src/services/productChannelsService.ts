import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { ChannelSummary, PriceRule, RuleChannel } from "@/lib/catalog/productChannels";

/** FEAT-32 M2 — canales de POWIP del producto (ms-products `src/product-channels/`). */

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export interface ProductChannelView {
  channel: RuleChannel;
  name: string;
  active: boolean;
  saved: boolean;
  rule: PriceRule;
  ruleLabel: string;
  listId: string | null;
  prices: Array<{ variantId: string; price: number; own: boolean; belowCost: boolean }>;
  ownPriceCount: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ProductChannelsView {
  productId: string;
  storeId: string;
  canEdit: boolean;
  igvIncluded: boolean;
  variants: Array<{ variantId: string; sku: string | null; attributeValues: Record<string, string>; storePrice: number; averageCost?: number | null }>;
  channels: ProductChannelView[];
}

export interface SaveProductChannelBody {
  storeId: string;
  channel: RuleChannel;
  active: boolean;
  rule: PriceRule;
}

export async function getProductChannels(productId: string, storeId: string, signal?: AbortSignal): Promise<ProductChannelsView> {
  const { data } = await axiosAuth.get<ProductChannelsView>(`${products()}/products/${encodeURIComponent(productId)}/channels`, {
    params: { storeId },
    signal,
  });
  return data;
}

export async function saveProductChannel(productId: string, body: SaveProductChannelBody): Promise<ProductChannelsView> {
  const { data } = await axiosAuth.put<ProductChannelsView>(`${products()}/products/${encodeURIComponent(productId)}/channels`, body);
  return data;
}

export async function getChannelSummary(signal?: AbortSignal): Promise<ChannelSummary> {
  const { data } = await axiosAuth.get<ChannelSummary>(`${products()}/product-channels/summary`, { signal });
  return data;
}
