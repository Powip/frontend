import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface OrderPaymentMethodCorrection {
  id: string;
  previousMethod: string;
  newMethod: string;
  reason: string;
  actorId: string;
  actorEmail?: string;
  createdAt: string;
  version: number;
}
export interface OrderPaymentMethod {
  paymentId: string;
  amount: number | string;
  currency: string;
  status: string;
  paymentDate: string;
  recordedLedgerMethod: string;
  effectiveOrderMethod: string;
  version: number;
  history: OrderPaymentMethodCorrection[];
}
export interface OrderPaymentMethods {
  orderId: string;
  canCorrect: boolean;
  allowedMethods: string[];
  payments: OrderPaymentMethod[];
}
export interface CorrectOrderPaymentMethodInput {
  newMethod: string;
  reason: string;
  requestId: string;
  expectedVersion: number;
}
const base = (orderId: string) => `${GATEWAY.ventas}/order-header/${encodeURIComponent(orderId)}`;

export async function getOrderPaymentMethods(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderPaymentMethods> {
  const { data } = await axiosAuth.get<OrderPaymentMethods>(
    `${base(orderId)}/payment-method-corrections`,
    { signal },
  );
  if (
    data.orderId !== orderId ||
    !Array.isArray(data.payments) ||
    !Array.isArray(data.allowedMethods)
  ) {
    throw new Error("No se pudieron verificar los métodos del pedido.");
  }
  return data;
}
export async function correctOrderPaymentMethod(
  orderId: string,
  paymentId: string,
  input: CorrectOrderPaymentMethodInput,
): Promise<OrderPaymentMethod> {
  return (
    await axiosAuth.post<OrderPaymentMethod>(
      `${base(orderId)}/payments/${encodeURIComponent(paymentId)}/method-corrections`,
      input,
    )
  ).data;
}

export function orderMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    YAPE: "Yape",
    PLIN: "Plin",
    CONTRAENTREGA: "Contraentrega",
    CONTRA_ENTREGA: "Contraentrega",
    BCP: "BCP",
    BANCO_NACION: "Banco de la Nación",
    MERCADO_PAGO: "Mercado Pago",
    POS: "POS",
    TRANSFERENCIA: "Transferencia",
    EFECTIVO: "Efectivo",
  };
  return labels[method] ?? method;
}
