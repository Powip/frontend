import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { writeConfigArgs } from "@/lib/idempotency";

/**
 * FEAT-24 H12 (H12-D2) — cambio de producto después del despacho (ms-ventas, JWT, permisos de Atención al
 * cliente). Crea una devolución parcial «por recibir» en Recepciones y un pedido hijo CAMBIO.
 */
const ventas = () => process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;

export interface ExchangeLineInput {
  itemId: string;
  newVariantId: string;
  quantity: number;
}

export interface OrderExchange {
  exchangeId: string;
  operationId?: string;
  status: "aplicado" | "pendiente";
  orderId: string;
  childOrderId: string | null;
  childOrderNumber: string | null;
  returnReceptionId: string | null;
  priceDifference: number | string | null;
  lines: Array<{
    itemId: string;
    variantId: string;
    sku: string | null;
    productName: string | null;
    newVariantId: string;
    newSku: string | null;
    newProductName: string | null;
    quantity: number;
    unitPrice: number | string | null;
  }>;
  reason: string | null;
  createdAt: string;
  appliedAt: string | null;
  duplicate?: boolean;
}

/**
 * La clave va siempre en el cuerpo (`operationId`) y, si el header está habilitado, también como
 * `Idempotency-Key` (mismo valor). La misma clave repite el cambio ya registrado.
 */
export async function createOrderExchange(
  orderId: string,
  body: { lines: ExchangeLineInput[]; reason?: string },
  idempotencyKey: string,
): Promise<OrderExchange> {
  const { data } = await axiosAuth.post<OrderExchange>(
    `${ventas()}/order-header/${encodeURIComponent(orderId)}/exchange`,
    { ...body, operationId: idempotencyKey },
    ...writeConfigArgs({ idempotencyKey }),
  );
  return data;
}

export async function listOrderExchanges(orderId: string, signal?: AbortSignal): Promise<OrderExchange[]> {
  const { data } = await axiosAuth.get<{ items?: OrderExchange[] }>(
    `${ventas()}/order-header/${encodeURIComponent(orderId)}/exchanges`,
    { signal },
  );
  return Array.isArray(data?.items) ? data.items : [];
}
