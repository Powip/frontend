import axiosAuth from "@/lib/axiosAuth";
import type { OrderStockState } from "@/lib/orderStock";

// FEAT-24 H2-F — stock de los pedidos en ms-ventas (contrato H2-C): bandejas
// «Sin stock» / «Sin reserva», su gestión, picking, «Devuelto por courier» y
// cambio del almacén de la reserva. La empresa sale siempre del token.

const base = () => `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header`;
const orderUrl = (orderId: string, path: string) => `${base()}/${encodeURIComponent(orderId)}/${path}`;

export type StockTray = "sin-stock" | "sin-reserva";
export type OutOfStockHandling = "pendiente" | "cambio" | "espera" | "anulado";

export interface StockTrayLine {
  itemId: string;
  productName: string | null;
  sku: string | null;
  variantId: string | null;
  quantity: number;
  /** Alternativas sugeridas: hoy el servidor siempre las manda vacías. */
  alternatives: unknown[];
}

export interface StockTrayRow {
  orderId: string;
  orderNumber: string;
  status: string;
  storeId: string;
  inventoryId: string | null;
  stockState: OrderStockState | string | null;
  outOfStockSince: string | null;
  handling: OutOfStockHandling | null;
  customerNotifiedAt: string | null;
  customer: { id: string | null; fullName: string | null; phoneNumber: string | null };
  grandTotal: number;
  lines: StockTrayLine[];
}

export interface StockTrayPage {
  total: number;
  limit: number;
  offset: number;
  rows: StockTrayRow[];
}

export async function getStockTray(tray: StockTray, page: { limit: number; offset: number }): Promise<StockTrayPage> {
  const { data } = await axiosAuth.get<StockTrayPage>(`${base()}/stock-trays/${tray}`, {
    params: { limit: page.limit, offset: page.offset },
  });
  return data;
}

export type StockHandlingAction = "cambio" | "espera" | "anular" | "re_reservar";

export type StockHandlingResult =
  | { action: "re_reservar"; stockState: string | null }
  | { action: "anular"; status: string }
  | { action: "espera"; template: string; phone: string | null; whatsappUrl: string | null }
  | { action: "cambio"; next: string };

export async function handleOutOfStockOrder(orderId: string, action: StockHandlingAction): Promise<StockHandlingResult> {
  const { data } = await axiosAuth.post<StockHandlingResult>(orderUrl(orderId, "stock-handling"), { action });
  return data;
}

export async function releaseReservation(orderId: string, reason: string): Promise<{ stockState: string | null }> {
  const { data } = await axiosAuth.post<{ stockState: string | null }>(orderUrl(orderId, "release-reservation"), { reason });
  return data;
}

export async function markCourierReturn(orderId: string, note?: string): Promise<unknown> {
  const trimmed = note?.trim();
  const { data } = await axiosAuth.post(orderUrl(orderId, "courier-return"), trimmed ? { note: trimmed } : {});
  return data;
}

export async function changeReservationWarehouse(orderId: string, inventoryId: string): Promise<unknown> {
  const { data } = await axiosAuth.patch(orderUrl(orderId, "stock-warehouse"), { inventoryId });
  return data;
}

/* ---------------------------------------------------------------------------
   Picking
--------------------------------------------------------------------------- */

export interface PickingLine {
  itemId: string;
  productName: string | null;
  sku: string | null;
  variantId: string | null;
  quantity: number;
  picked: number;
  /** Unidades confirmadas sin escanear. */
  manual: number;
  pending: number;
  /** false = la línea no está vinculada al catálogo (no se puede escanear). */
  linked: boolean;
}

export interface PickingView {
  orderId: string;
  orderNumber: string;
  status: string;
  /** `null` = el servidor no pudo leer las reglas de inventario. */
  pickingRequired: boolean | null;
  completedAt: string | null;
  completedBy: string | null;
  complete: boolean;
  lines: PickingLine[];
}

export interface PickingCompletion extends PickingView {
  dispatched: boolean;
  message?: string;
}

export async function getPicking(orderId: string): Promise<PickingView> {
  const { data } = await axiosAuth.get<PickingView>(orderUrl(orderId, "picking"));
  return data;
}

export async function scanPicking(orderId: string, code: string): Promise<PickingView> {
  const { data } = await axiosAuth.post<PickingView>(orderUrl(orderId, "picking/scan"), { code });
  return data;
}

export async function confirmPickingLine(orderId: string, itemId: string): Promise<PickingView> {
  const { data } = await axiosAuth.post<PickingView>(orderUrl(orderId, "picking/confirm-line"), { itemId });
  return data;
}

export async function completePicking(orderId: string): Promise<PickingCompletion> {
  const { data } = await axiosAuth.post<PickingCompletion>(orderUrl(orderId, "picking/complete"), {});
  return data;
}
