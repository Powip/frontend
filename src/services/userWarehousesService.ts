import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H6 — usuarios por almacén (H6-D5). Fachada de ms-products: la empresa
// y el usuario salen del token. Sin asignaciones, el usuario ve y opera todos
// los almacenes; con asignaciones, VE solo esos y OPERA los que tienen
// `canOperate`.

const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export interface MyWarehouses {
  /** `true` = sin asignaciones: ve y opera todos. */
  all: boolean;
  /** Almacenes que ve. */
  inventoryIds: string[];
  /** Almacenes donde puede mover stock. */
  operableIds: string[];
}

export interface UserWarehouseAssignment {
  userId: string;
  inventoryId: string;
  inventoryName: string | null;
  canOperate: boolean;
  createdAt?: string;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export async function getMyWarehouses(signal?: AbortSignal): Promise<MyWarehouses> {
  const { data } = await axiosAuth.get<Partial<MyWarehouses>>(`${products()}/me/warehouses`, { signal });
  return { all: data?.all === true, inventoryIds: strings(data?.inventoryIds), operableIds: strings(data?.operableIds) };
}

/** Solo Administrador. Sin `userId`, las de toda la empresa. */
export async function listUserWarehouses(userId?: string, signal?: AbortSignal): Promise<UserWarehouseAssignment[]> {
  const { data } = await axiosAuth.get<{ items?: UserWarehouseAssignment[] }>(`${products()}/user-warehouses`, {
    params: userId ? { userId } : undefined,
    signal,
  });
  return Array.isArray(data?.items) ? data.items : [];
}

/** Solo Administrador. REEMPLAZA la lista del usuario; vacía = vuelve a ver y operar todos. */
export async function saveUserWarehouses(body: {
  userId: string;
  warehouses: Array<{ inventoryId: string; canOperate: boolean }>;
}): Promise<void> {
  await axiosAuth.put(`${products()}/user-warehouses`, body);
}
