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

// FEAT-24 H2-D/H2-F — reglas de reserva por región, reglas de inventario y
// recepciones de devoluciones. Misma fachada: la empresa (y quién recibe) sale
// del token; las respuestas de ms-logistics llegan tal cual.

export interface ReservationRule {
  id: string;
  priority: number;
  department: string | null;
  province: string | null;
  storeId: string | null;
  inventoryId: string;
  active: boolean;
}

/** Una regla al guardar: la prioridad es única (menor = se evalúa antes). `null` = cualquiera. */
export interface ReservationRuleInput {
  priority: number;
  department: string | null;
  province: string | null;
  storeId: string | null;
  inventoryId: string;
  active: boolean;
}

export interface InventoryRules {
  /** Días sin despachar para liberar la reserva; `null` = nunca. */
  releaseAfterDays: number | null;
  pickingRequired: boolean;
}

export type ReturnReceptionStatus = "por_recibir" | "recibida";
export type ReturnResult = "reingreso" | "merma";

export interface ReturnReceptionLine {
  variantId: string;
  quantity: number;
}

export interface ReceivedReturnLine {
  variantId: string;
  quantity: number;
  result: ReturnResult;
  reason: string | null;
}

export interface ReturnReception {
  id: string;
  companyId: string;
  orderId: string;
  orderNumber: string | null;
  /** Almacén del pedido: ahí quedó «por recibir». */
  inventoryId: string;
  status: ReturnReceptionStatus;
  lines: ReturnReceptionLine[];
  createdAt: string;
  receivedAt: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
  receivedInventoryId: string | null;
  receivedLines: ReceivedReturnLine[] | null;
  /** Solo en la respuesta de recibir: la misma recepción ya estaba registrada así. */
  duplicate?: boolean;
}

export interface ReceiveReturnBody {
  /** Almacén al que reingresa; sin él, el del pedido. */
  inventoryId?: string;
  lines: Array<{ variantId: string; quantity: number; result: ReturnResult; reason?: string }>;
}

export async function getReservationRules(): Promise<ReservationRule[]> {
  const { data } = await axiosAuth.get<{ rules?: ReservationRule[] }>(`${base()}/reservation-rules`);
  return Array.isArray(data?.rules) ? data.rules : [];
}

/** Reemplaza la lista completa (máximo 200). Devuelve la lista guardada. */
export async function saveReservationRules(rules: ReservationRuleInput[]): Promise<ReservationRule[]> {
  const { data } = await axiosAuth.put<{ rules?: ReservationRule[] }>(`${base()}/reservation-rules`, { rules });
  return Array.isArray(data?.rules) ? data.rules : [];
}

export async function getInventoryRules(): Promise<InventoryRules> {
  const { data } = await axiosAuth.get<InventoryRules>(`${base()}/inventory-rules`);
  return { releaseAfterDays: data?.releaseAfterDays ?? null, pickingRequired: data?.pickingRequired === true };
}

export async function saveInventoryRules(rules: InventoryRules): Promise<InventoryRules> {
  const { data } = await axiosAuth.put<InventoryRules>(`${base()}/inventory-rules`, {
    releaseAfterDays: rules.releaseAfterDays,
    pickingRequired: rules.pickingRequired,
  });
  return { releaseAfterDays: data?.releaseAfterDays ?? null, pickingRequired: data?.pickingRequired === true };
}

export async function listReturnReceptions(status: ReturnReceptionStatus): Promise<ReturnReception[]> {
  const { data } = await axiosAuth.get<{ items?: ReturnReception[] }>(`${base()}/return-receptions`, {
    params: { status },
  });
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * Recibe TODA la devolución de una vez. Repetir lo mismo responde la recepción
 * con `duplicate: true`; algo distinto, 409 con el motivo.
 */
export async function receiveReturnReception(id: string, body: ReceiveReturnBody): Promise<ReturnReception> {
  const { data } = await axiosAuth.post<ReturnReception>(
    `${base()}/return-receptions/${encodeURIComponent(id)}/receive`,
    body,
  );
  return data;
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
