import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export type TrackingMode = "NONE" | "SERIAL" | "IMEI";
export const isTracked = (mode?: string) => mode === "SERIAL" || mode === "IMEI";
const API = `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/tracking`;

export interface InventoryUnit {
  id: string;
  code: string;
  normalizedCode?: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "WRITTEN_OFF";
}
export interface ProductTrackingContext {
  productId: string;
  trackingMode: TrackingMode;
  pendingActivation?: { operationId: string; trackingMode: "SERIAL" | "IMEI" } | null;
  catalogVariants?: { id: string; sku: string; attributeValues?: Record<string, string> }[];
  variants: {
    variantId: string;
    inventoryItemId: string | null;
    inventoryId: string;
    inventoryName: string;
    quantity: number;
    reservedQuantity: number;
    unitCount: number;
    trackingMode: TrackingMode;
  }[];
}
export interface RegularizationRequest {
  operationId: string;
  trackingMode: "SERIAL" | "IMEI";
  items: {
    variantId: string;
    inventoryItemId?: string;
    inventoryId?: string;
    expectedQuantity: number;
    codes: string[];
  }[];
}
export interface RegularizationResult {
  operationId: string;
  productId: string;
  trackingMode: TrackingMode;
  unitCount: number;
  stockBefore: number;
  stockAfter: number;
  alreadyApplied?: boolean;
}

/** Split pasted/scanned lines as text: leading zeroes must survive. */
export function parseUnitCodes(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((code) => code.replace(/^ +| +$/g, ""))
    .filter(Boolean);
}

export function validateUnitCodes(
  lines: { trackingMode?: TrackingMode; quantity: number; codes: string[]; label?: string }[],
): string | null {
  const seen = new Set<string>();
  for (const line of lines) {
    if (!isTracked(line.trackingMode)) continue;
    const label = line.label || "Producto";
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 0)
      return `${label}: la cantidad debe ser un entero no negativo.`;
    if (line.codes.length !== line.quantity)
      return `${label}: registra ${line.quantity} códigos, uno por unidad (${line.codes.length} ingresados).`;
    for (const raw of line.codes) {
      const code = raw.replace(/^ +| +$/g, "").toUpperCase();
      if (
        line.trackingMode === "IMEI"
          ? !/^[0-9]{1,100}$/.test(code)
          : !/^[A-Z0-9._/-]{1,100}$/.test(code)
      ) {
        return line.trackingMode === "IMEI"
          ? `${label}: cada IMEI debe contener solo números, hasta 100 caracteres.`
          : `${label}: usa series de 1 a 100 letras, números, puntos, guiones, barras o guiones bajos.`;
      }
      if (seen.has(code))
        return `Código duplicado: ${raw}. Revisa todas las líneas de la compra o regularización.`;
      seen.add(code);
    }
  }
  return null;
}

export function trackingError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join(". ");
  return typeof message === "string" ? message : error instanceof Error ? error.message : fallback;
}

/** Only a definite rejection lets the user replace a request with a new operation. */
export function canCorrectTrackingRequest(error: unknown): boolean {
  return [400, 403, 404, 409, 422].includes(
    (error as { response?: { status?: number } })?.response?.status ?? 0,
  );
}

export const getProductTracking = async (id: string, signal?: AbortSignal) =>
  (await axiosAuth.get<ProductTrackingContext>(`${API}/products/${id}`, { signal })).data;
export const regularizeProduct = async (id: string, payload: RegularizationRequest) =>
  (await axiosAuth.post<RegularizationResult>(`${API}/products/${id}/regularize`, payload)).data;
export const resumeProductTracking = async (id: string) =>
  (await axiosAuth.post<RegularizationResult>(`${API}/products/${id}/resume`)).data;
export const cancelProductActivation = async (id: string) =>
  (await axiosAuth.post(`${API}/products/${id}/cancel-activation`)).data;
export const getInventoryUnits = async (
  id: string,
  page: number,
  q: string,
  signal?: AbortSignal,
) =>
  (
    await axiosAuth.get<{ data: InventoryUnit[]; meta: { total: number; totalPages: number } }>(
      `${API}/items/${id}/units`,
      { params: { page, limit: 20, q: q || undefined }, signal },
    )
  ).data;
export const getTrackedPurchase = async <T>(id: string, signal?: AbortSignal): Promise<T> =>
  (await axiosAuth.get<T>(`${API}/purchases/${id}`, { signal })).data;
export const createTrackedPurchase = async <T>(payload: T) =>
  (await axiosAuth.post(`${API}/purchases`, payload)).data;
export const updateTrackedPurchase = async <T>(id: string, payload: T) =>
  (await axiosAuth.put(`${API}/purchases/${id}`, payload)).data;
export const deleteTrackedPurchase = async (id: string) =>
  (await axiosAuth.delete(`${API}/purchases/${id}`)).data;

export interface PurchaseLineInput {
  variantId: string;
  supplierId: string;
  supplierName: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  attributes?: Record<string, string>;
  trackingMode?: TrackingMode;
  codes?: string[];
}
/** Normal items keep their original payload, including inside a mixed purchase. */
export function purchaseLinePayload(item: PurchaseLineInput) {
  return {
    variantId: item.variantId,
    supplierId: item.supplierId,
    supplierName: item.supplierName,
    sku: item.sku,
    productName: item.productName,
    quantity: item.quantity,
    unitCost: item.unitCost,
    attributes: item.attributes,
    ...(isTracked(item.trackingMode) ? { codes: item.codes ?? [] } : {}),
  };
}


export interface SaleUnitsResponse {
  inventoryItemId: string | null;
  variantId: string;
  inventoryId: string;
  trackingMode: TrackingMode;
  data: InventoryUnit[];
  meta: { total: number; totalPages: number; page: number; limit: number };
}
export const getSaleUnits = async (
  params: { variantId: string; inventoryId: string; orderId?: string; q?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) => (await axiosAuth.get<SaleUnitsResponse>(`${API}/sale-units`, { params, signal })).data;
