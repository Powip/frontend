import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H1-A — almacenes de la empresa. Van por la fachada autenticada de
// ms-products (/warehouses), que toma la empresa del token: este servicio
// nunca envía un companyId.
export type WarehouseType = "PROPIO" | "TIENDA" | "COURIER";

export interface CompanyWarehouse {
  id: string;
  name: string;
  status: boolean;
  store_id: string;
  company_id: string;
  type: WarehouseType;
  is_main: boolean;
}

export interface WarehouseStoreLink {
  store_id: string;
  inventory_id: string;
  is_default: boolean;
}

export interface CompanyWarehouses {
  warehouses: CompanyWarehouse[];
  links: WarehouseStoreLink[];
}

const base = () => `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/warehouses`;

export async function listWarehouses(): Promise<CompanyWarehouses> {
  const { data } = await axiosAuth.get<CompanyWarehouses>(base());
  return data;
}

export async function createWarehouse(input: {
  name: string;
  storeId: string;
  type?: WarehouseType;
}): Promise<CompanyWarehouse> {
  const { name, storeId, type } = input;
  const { data } = await axiosAuth.post<CompanyWarehouse>(base(), {
    name,
    storeId,
    ...(type ? { type } : {}),
  });
  return data;
}

export async function setWarehouseType(id: string, type: WarehouseType): Promise<void> {
  await axiosAuth.put(`${base()}/${encodeURIComponent(id)}/type`, { type });
}

export async function setMainWarehouse(id: string): Promise<void> {
  await axiosAuth.put(`${base()}/${encodeURIComponent(id)}/main`);
}

export async function setStoreDefaultWarehouse(storeId: string, inventoryId: string): Promise<void> {
  await axiosAuth.put(
    `${base()}/stores/${encodeURIComponent(storeId)}/default/${encodeURIComponent(inventoryId)}`,
  );
}

/**
 * Elimina un almacén. ms-logistics (no la fachada) valida: solo se borra uno
 * vacío y sin pedidos, movimientos, productos ni integraciones vinculadas, y
 * nunca el principal (409 con el motivo). La empresa sale del token.
 */
export async function deleteWarehouse(id: string): Promise<void> {
  await axiosAuth.delete(
    `${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/inventory/${encodeURIComponent(id)}`,
  );
}
