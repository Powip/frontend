import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { BusinessInventory } from "./inventoryCatalogService";
import { format, parseISO } from "date-fns";

export interface InventoryMovement {
  id: string;
  type: "IN" | "OUT" | "RESERVED" | "RELEASED" | "COMMITTED" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  reason: string | null;
  userEmail: string | null;
  userName: string | null;
  companyId: string | null;
  referenceId: string | null;
  created_at: string;
  inventoryId?: string;
  inventoryName?: string;
  storeName?: string;
  inventoryItem: {
    id: string;
    sku: string;
    product: {
      name: string;
    } | null;
  } | null;
}

export interface MovementsResponse {
  data: InventoryMovement[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getMovementsByCompany(
  companyId: string,
  params: { 
    page?: number; 
    limit?: number;
    type?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {},
  options?: { accessToken?: string; signal?: AbortSignal },
): Promise<MovementsResponse> {
  const res = await axiosAuth.get<MovementsResponse>(
    `${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory-movement/company/${companyId}`,
    { params, signal: options?.signal, headers: options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : undefined }
  );
  return res.data;
}


/** Company history keeps every record; store history resolves raw item IDs without product enrichment. */
export async function fetchScopedInventoryMovements({ companyId, accessToken, scope, inventories, signal }: {
  companyId: string; accessToken: string; scope: "business" | "store"; inventories: BusinessInventory[]; signal?: AbortSignal;
}): Promise<InventoryMovement[]> {
  if (!companyId || !accessToken) throw new Error("La sesión no permite consultar el historial.");
  const itemOrigins = new Map<string, BusinessInventory>();
  if (scope === "store") {
    const unique = [...new Map(inventories.map((inventory) => [inventory.id, inventory])).values()];
    await Promise.all(unique.map(async (inventory) => {
      const { data } = await axiosAuth.get(`${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory-item/inventory/${inventory.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal,
      });
      if (!Array.isArray(data) || data.some((item) => !item || typeof item.id !== "string" || !item.id)) throw new Error("No se pudo identificar el origen de los movimientos.");
      for (const item of data) {
        const previous = itemOrigins.get(item.id);
        if (previous && previous.id !== inventory.id) throw new Error("El origen del movimiento es ambiguo.");
        itemOrigins.set(item.id, inventory);
      }
    }));
    if (unique.length === 0) return [];
  }
  const movements = new Map<string, InventoryMovement>();
  let page = 1;
  let totalPages = 1;
  do {
    // Backend search filters after skip/take and reports only that page's matching total.
    const response = await getMovementsByCompany(companyId, { page, limit: 100 }, { accessToken, signal });
    totalPages = Number(response?.meta?.totalPages);
    if (!Array.isArray(response?.data) || !Number.isInteger(totalPages) || totalPages < 0 || Number(response?.meta?.page) !== page || (totalPages === 0 && response.data.length > 0)) throw new Error("No se pudo interpretar el historial de movimientos.");
    for (const movement of response.data) {
      if (!movement?.id || movement.companyId !== companyId || typeof movement.created_at !== "string" || !Number.isFinite(Date.parse(movement.created_at))) throw new Error("El historial no corresponde al negocio activo.");
      const origin = movement.inventoryItem?.id ? itemOrigins.get(movement.inventoryItem.id) : undefined;
      if (scope === "store" && !origin) continue;
      movements.set(movement.id, origin ? { ...movement, inventoryId: origin.id, inventoryName: origin.name, storeName: origin.storeName } : movement);
    }
    page++;
  } while (page <= totalPages);
  return [...movements.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
}

export function filterInventoryMovements(movements: InventoryMovement[], filters: { search?: string; type?: string; userEmail?: string; startDate?: string; endDate?: string }) {
  const query = filters.search?.trim().toLocaleLowerCase("es") ?? "";
  return movements.filter((movement) => {
    const date = format(parseISO(movement.created_at), "yyyy-MM-dd");
    return (!filters.type || movement.type === filters.type) && (!filters.userEmail || movement.userEmail === filters.userEmail) &&
      (!filters.startDate || date >= filters.startDate) && (!filters.endDate || date <= filters.endDate) &&
      (!query || [movement.inventoryItem?.product?.name, movement.inventoryItem?.sku].some((value) => String(value ?? "").toLocaleLowerCase("es").includes(query)));
  });
}
