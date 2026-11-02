import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
export interface CourierPaymentEvidence {
  id: string;
  orderId: string;
  provider: "EVA";
  providerStatus: string;
  trackingId: string;
  reportedAmount: string | null;
  photos: string[];
  occurredAt: string;
  createdAt: string;
  verificationStatus: "PENDING_REVIEW";
}
export interface OrderCourierPaymentEvidence {
  orderId: string;
  evidence: CourierPaymentEvidence[];
  payments: {
    paymentId: string;
    amount: string | number;
    currency: string;
    status: string;
    recordedLedgerMethod: string;
    paymentDate: string;
  }[];
}
export async function getOrderCourierPaymentEvidence(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderCourierPaymentEvidence> {
  const { data } = await axiosAuth.get<OrderCourierPaymentEvidence>(
    `${GATEWAY.ventas}/order-header/${encodeURIComponent(orderId)}/courier-payment-evidence`,
    { signal },
  );
  if (
    data.orderId !== orderId ||
    !Array.isArray(data.evidence) ||
    data.evidence.some((entry) => entry.orderId !== orderId)
  )
    throw new Error("No se pudo verificar la evidencia de este pedido.");
  return data;
}
