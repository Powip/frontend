import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { OrderResponseDto } from "@/features/sales/dto/order.dto";
import { isCommercialSale } from "@/utils/commercialOrderReporting";
import type { OrderStatus } from "@/interfaces/IOrder";

interface DashboardOrdersOptions {
  signal?: AbortSignal;
  includeCcLeads?: boolean;
  statuses?: OrderStatus[];
}

interface DashboardOrderListOptions extends DashboardOrdersOptions {
  includeCommercialLeads?: boolean;
  currency?: string;
}

function ordersParams(fromDate: string | undefined, toDate: string | undefined, options: DashboardOrdersOptions) {
  return {
    fromDate,
    toDate,
    ...(options.includeCcLeads ? { includeCcLeads: true } : {}),
    ...(options.statuses?.length ? { status: options.statuses.join(",") } : {}),
  };
}

export async function getDashboardOrders<T extends { id: string } = OrderResponseDto>(
  storeIds: string[],
  fromDate: string | undefined,
  toDate: string | undefined,
  accessToken: string,
  options: DashboardOrderListOptions = {},
): Promise<T[]> {
  const responses = await Promise.all(
    [...new Set(storeIds)].map((storeId) =>
      axiosAuth.get<T[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas}/order-header/store/${storeId}`,
        {
          params: ordersParams(fromDate, toDate, options),
          headers: { Authorization: `Bearer ${accessToken}` },
          ...(options.signal ? { signal: options.signal } : {}),
        },
      ),
    ),
  );
  if (responses.some((response) => !Array.isArray(response.data))) throw new Error("Respuesta de pedidos inválida");
  return Array.from(new Map(responses.flatMap((response) => response.data).filter((order) => options.includeCommercialLeads || isCommercialSale(order)).filter((order) => !options.currency || ((order as {currency?: string | null}).currency ?? "UNKNOWN") === options.currency).map((order) => [order.id, order])).values());
}

/** Cantidad de pedidos (suma de todas las tiendas) sin descargar la lista. */
export async function getDashboardOrdersCount(
  storeIds: string[],
  fromDate: string | undefined,
  toDate: string | undefined,
  accessToken: string,
  options: DashboardOrdersOptions = {},
): Promise<number> {
  const responses = await Promise.all(
    [...new Set(storeIds)].map((storeId) =>
      axiosAuth.get<{ count: number }>(
        `${process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas}/order-header/store/${storeId}/count`,
        {
          params: ordersParams(fromDate, toDate, options),
          headers: { Authorization: `Bearer ${accessToken}` },
          ...(options.signal ? { signal: options.signal } : {}),
        },
      ),
    ),
  );
  if (responses.some((response) => typeof response.data?.count !== "number")) throw new Error("Respuesta de conteo inválida");
  return responses.reduce((total, response) => total + response.data.count, 0);
}
