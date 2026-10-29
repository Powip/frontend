import axiosAuth from "@/lib/axiosAuth";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { SalesFilters } from "@/components/ventas/SalesTableFilters";

export type BusinessSalesTab = "pendientes" | "anuladas" | "todas";

export interface BusinessSalesQuery extends Partial<SalesFilters> {
  tab: BusinessSalesTab;
  page: number;
  limit: number;
  kpiDateFrom?: string;
  kpiDateTo?: string;
  includeSummary?: boolean;
  checkStock?: boolean;
  sort?: "created_desc" | "updated_asc";
}

export interface BusinessSalesOrder extends OrderHeader {
  /** Server confirmation eligibility for Sales; physical mutations still validate stock separately. */
  salesOperationalEligible?: boolean;
}

export interface BusinessSalesPage {
  data: BusinessSalesOrder[];
  total: number;
  page: number;
  totalPages: number;
  counts?: { pendientes: number; anuladas: number; todas: number; pendientesAntiguos?: number } | null;
  kpis?: {
    pendientes: number;
    anuladas: number;
    amounts: { currency: string | null; paid: number; pending: number }[];
  } | null;
  metadata?: { couriers: string[]; statuses: string[]; channels: string[]; products?: { value: string; label: string }[] };
}

export async function getBusinessSalesPage(
  storeIds: readonly string[],
  query: BusinessSalesQuery,
  signal?: AbortSignal,
): Promise<BusinessSalesPage> {
  const ids = [...new Set(storeIds)].sort();
  if (!ids.length || ids.length > 200 || ids.some((id) => !id.trim())) {
    throw new Error("Selecciona tiendas válidas del negocio.");
  }
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100
  ) {
    throw new Error("La página solicitada no es válida.");
  }
  const params = new URLSearchParams({ storeIds: ids.join(",") });
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return (
    await axiosAuth.get<BusinessSalesPage>(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/business/list?${params}`,
      { signal },
    )
  ).data;
}

/** Called only for an explicit export, never while opening the sales screen. */
export async function getBusinessSalesExport(
  storeIds: readonly string[],
  query: BusinessSalesQuery,
  signal?: AbortSignal,
): Promise<BusinessSalesOrder[]> {
  const orders = new Map<string, BusinessSalesOrder>();
  let page = 1;
  let totalPages = 1;
  do {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Exportación cancelada", "AbortError");
    }
    const result = await getBusinessSalesPage(
      storeIds,
      { ...query, page, limit: 100, includeSummary: false, checkStock: false },
      signal,
    );
    for (const order of result.data) orders.set(order.id, order);
    if (page === 1) totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return [...orders.values()];
}
