import axios from "axios";
import { type AdvertisingOrderBasis, advertisingOrdersApiBase } from "./advertisingOrdersService";
import { AdvertisingApiError } from "./advertisingService";

export interface AdvertisingBusinessMetricsFilters {
  from: string;
  to: string;
  basis: AdvertisingOrderBasis;
  timeZone: string;
  storeId: string;
  channelId: string;
}
export interface AdvertisingBusinessMetrics {
  source: "powip-business-metrics";
  definition: "delivered-order-grand-total-v1";
  from: string;
  to: string;
  basis: AdvertisingOrderBasis;
  timeZone: string;
  storeId: string;
  channelId: string;
  deliveredCount: number;
  totalOrders: number;
  attributedDeliveredCount: number;
  unknownChannelCount: number;
  legacyStoreCount: number;
  quality: {
    missingDeliveredDateCount: number;
    missingPaidDateCount: number;
    unknownCurrencyCount: number;
  };
  currencies: Array<{
    currency: string | null;
    totalOrders: number;
    deliveredCount: number;
    deliveredRevenue: string;
    attributedDeliveredCount: number;
    attributedRevenue: string;
    unknownChannelCount: number;
    legacyStoreCount: number;
  }>;
  coverage: { complete: boolean; reasons: string[] };
}
export async function getAdvertisingBusinessMetrics(
  token: string,
  companyId: string,
  filters: AdvertisingBusinessMetricsFilters,
  signal?: AbortSignal,
): Promise<AdvertisingBusinessMetrics> {
  if (!token || token.length > 16_384 || /\s/.test(token))
    throw new AdvertisingApiError("Vuelve a iniciar sesión para continuar.", 401);
  const result = await axios.get<AdvertisingBusinessMetrics>(
    `${advertisingOrdersApiBase()}/advertising/companies/${encodeURIComponent(companyId)}/business-metrics`,
    {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: false,
      timeout: 30_000,
      signal,
      params: filters,
    },
  );
  return result.data;
}
