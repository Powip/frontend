import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  AiCartResult,
  CancelReason,
  CodOrder,
  DiscountRequest,
  DiscountResult,
  EvaluateInput,
  EvaluateResponse,
  PaymentReceipt,
  PromosResponse,
  ReceiptRejectReason,
  ReceiptStatus,
  SavePolicyInput,
  SimulatePaymentInput,
  StorePolicy,
  UploadReceiptInput,
} from "@/types/crmOrderPanel";

const PANEL = `${API.crm}/crm/order-panel`;
const conv = (id: string) => `${API.crm}/crm/conversations/${encodeURIComponent(id)}/order-panel`;
const cod = (id: string, orderId: string) => `${conv(id)}/cod/${encodeURIComponent(orderId)}`;
const storeParams = (storeId?: string | null) => (storeId ? { storeId } : {});

// ---------- Política de pagos por tienda (fila 25) ----------

export async function getStorePolicy(storeId?: string | null): Promise<StorePolicy> {
  return (await axiosAuth.get<StorePolicy>(`${PANEL}/policy`, { params: storeParams(storeId) })).data;
}

/** Solo supervisor/admin. `storeId` vacío = política general de la empresa. */
export async function saveStorePolicy(input: SavePolicyInput): Promise<StorePolicy> {
  return (await axiosAuth.put<StorePolicy>(`${PANEL}/policy`, input)).data;
}

// ---------- Promos, combos y descuentos (fila 24) ----------

export async function getPromos(storeId?: string | null): Promise<PromosResponse> {
  return (await axiosAuth.get<PromosResponse>(`${PANEL}/promos`, { params: storeParams(storeId) })).data;
}

export async function evaluatePromos(input: EvaluateInput): Promise<EvaluateResponse> {
  return (await axiosAuth.post<EvaluateResponse>(`${PANEL}/promos/evaluate`, input)).data;
}

export async function requestDiscount(
  conversationId: string,
  input: { percent: number; storeId?: string; reason?: string },
): Promise<DiscountResult> {
  return (await axiosAuth.post<DiscountResult>(`${conv(conversationId)}/discount`, input)).data;
}

/** Con `conversationId`: las del chat. Sin él: cola de pendientes (solo supervisor). */
export async function listDiscountRequests(conversationId?: string): Promise<DiscountRequest[]> {
  return (
    await axiosAuth.get<{ items: DiscountRequest[] }>(`${PANEL}/discounts`, {
      params: conversationId ? { conversationId } : {},
    })
  ).data.items;
}

export async function decideDiscount(id: string, approve: boolean): Promise<DiscountRequest> {
  return (await axiosAuth.patch<DiscountRequest>(`${PANEL}/discounts/${encodeURIComponent(id)}`, { approve })).data;
}

// ---------- IA arma el pedido (fila 23) ----------

export async function buildAiCart(
  conversationId: string,
  input: { storeId?: string; inventoryId?: string },
): Promise<AiCartResult> {
  return (await axiosAuth.post<AiCartResult>(`${conv(conversationId)}/ai-cart`, input)).data;
}

// ---------- Comprobantes y Finanzas (fila 26) ----------

export async function listReceipts(conversationId: string): Promise<PaymentReceipt[]> {
  return (await axiosAuth.get<{ items: PaymentReceipt[] }>(`${conv(conversationId)}/receipts`)).data.items;
}

export async function uploadReceipt(conversationId: string, input: UploadReceiptInput): Promise<PaymentReceipt> {
  const form = new FormData();
  form.append("method", input.method);
  form.append("amount", String(input.amount));
  if (input.operationNumber) form.append("operationNumber", input.operationNumber);
  if (input.orderId) form.append("orderId", input.orderId);
  if (input.quotationId) form.append("quotationId", input.quotationId);
  if (input.file) form.append("file", input.file);
  if (input.messageId) form.append("messageId", input.messageId);
  return (await axiosAuth.post<PaymentReceipt>(`${conv(conversationId)}/receipts`, form)).data;
}

/** Solo pruebas: el servidor lo apaga en producción o con ORDER_PAY_SIMULATOR=off. */
export async function simulatePayment(conversationId: string, input: SimulatePaymentInput): Promise<PaymentReceipt> {
  return (await axiosAuth.post<PaymentReceipt>(`${conv(conversationId)}/simulate-payment`, input)).data;
}

export async function listFinanceQueue(status: ReceiptStatus = "porval", validatedBy?: "pau"): Promise<PaymentReceipt[]> {
  return (
    await axiosAuth.get<{ items: PaymentReceipt[] }>(`${PANEL}/receipts/queue`, {
      params: { status, ...(validatedBy ? { validatedBy } : {}) },
    })
  ).data.items;
}

export async function getReceiptFile(id: string): Promise<Blob> {
  return (
    await axiosAuth.get<Blob>(`${PANEL}/receipts/${encodeURIComponent(id)}/file`, { responseType: "blob" })
  ).data;
}

export async function reviewReceipt(
  id: string,
  approve: boolean,
  note?: string,
  reason?: ReceiptRejectReason,
): Promise<PaymentReceipt> {
  return (
    await axiosAuth.patch<PaymentReceipt>(`${PANEL}/receipts/${encodeURIComponent(id)}/review`, {
      approve,
      ...(note ? { note } : {}),
      ...(reason ? { reason } : {}),
    })
  ).data;
}

/**
 * Aprueba o rechaza un pago del Core que viene de un comprobante de Pau (mismo efecto que «Aceptar»
 * en el chat). Devuelve null si el pago no es de Pau: el llamador sigue con el flujo normal de pagos.
 */
export async function reviewCorePayment(
  paymentId: string,
  approve: boolean,
  note?: string,
  reason?: ReceiptRejectReason,
): Promise<PaymentReceipt | null> {
  try {
    return (
      await axiosAuth.patch<PaymentReceipt>(`${PANEL}/payments/${encodeURIComponent(paymentId)}/review`, {
        approve,
        ...(note ? { note } : {}),
        ...(reason ? { reason } : {}),
      })
    ).data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/** Monto nuevo del pago de Pau (si el pago del Core es de Pau). Sin comprobante de Pau no hace nada. */
export async function updateCorePaymentReceiptAmount(paymentId: string, amount: number): Promise<void> {
  try {
    await axiosAuth.patch(`${PANEL}/payments/${encodeURIComponent(paymentId)}/amount`, { amount });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return;
    throw error;
  }
}

// ---------- Contra entrega con Gestión CC (fila 27) ----------

export async function getCodOrder(conversationId: string, orderId: string): Promise<CodOrder> {
  return (await axiosAuth.get<CodOrder>(cod(conversationId, orderId))).data;
}

/** 400 con code DNI_REQUIRED si el pedido no tiene DNI válido y no se envía uno. */
export async function confirmCod(conversationId: string, orderId: string, dni?: string): Promise<CodOrder> {
  return (await axiosAuth.post<CodOrder>(`${cod(conversationId, orderId)}/confirm`, dni ? { dni } : {})).data;
}

export async function cancelCod(
  conversationId: string,
  orderId: string,
  reason: CancelReason,
  detail?: string,
): Promise<CodOrder> {
  return (
    await axiosAuth.post<CodOrder>(`${cod(conversationId, orderId)}/cancel`, {
      reason,
      ...(detail ? { detail } : {}),
    })
  ).data;
}

export async function rescheduleCod(conversationId: string, orderId: string, comment?: string): Promise<CodOrder> {
  return (
    await axiosAuth.post<CodOrder>(`${cod(conversationId, orderId)}/reschedule`, comment ? { comment } : {})
  ).data;
}

export async function updateCodDni(conversationId: string, orderId: string, dni: string): Promise<CodOrder> {
  return (await axiosAuth.patch<CodOrder>(`${cod(conversationId, orderId)}/dni`, { dni })).data;
}
