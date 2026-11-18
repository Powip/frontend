/**
 * FEAT-24 H12 (H12-D2) — reglas del cambio de producto en el frontend (el backend vuelve a validar todo):
 * solo pedidos despachados o entregados, no Live, y líneas con variante, sin IMEI/serie, que no sean
 * packs y que todavía tengan unidades sin cambiar.
 */
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import type { OrderItem } from "@/interfaces/IOrder";

export const EXCHANGE_ORDER_STATUSES = ["DESPACHADO", "ENTREGADO"] as const;

export function canExchangeOrder(order: { status?: string | null; externalSource?: string | null } | null | undefined): boolean {
  if (!order?.status) return false;
  if (order.externalSource === "POWIP_LIVE") return false;
  return (EXCHANGE_ORDER_STATUSES as readonly string[]).includes(order.status);
}

export interface ExchangeableLine {
  itemId: string;
  variantId: string;
  productName: string;
  sku: string;
  attributes: Record<string, string>;
  /** Unidades que todavía se pueden cambiar. */
  remaining: number;
}

type ExchangeSourceItem = Pick<OrderItem, "id" | "productVariantId" | "productName" | "sku" | "attributes" | "quantity" | "trackingMode" | "packComponents" | "exchangedQuantity">;

export function exchangeableLines(items: readonly ExchangeSourceItem[] | null | undefined): ExchangeableLine[] {
  return (items ?? []).flatMap((item) => {
    const remaining = Number(item.quantity ?? 0) - Number(item.exchangedQuantity ?? 0);
    if (!item.id || !item.productVariantId || remaining <= 0) return [];
    if (Array.isArray(item.packComponents) && item.packComponents.length > 0) return [];
    if (item.trackingMode && item.trackingMode !== "NONE") return [];
    return [{ itemId: item.id, variantId: item.productVariantId, productName: item.productName, sku: item.sku, attributes: item.attributes ?? {}, remaining }];
  });
}

export type ExchangeFailure =
  /** El servidor lo rechazó (4xx): no se registró nada; la próxima vez va con otra clave. */
  | { kind: "rejected"; message: string }
  /** Quedó pendiente (503) o no hubo respuesta: se reintenta con la misma clave y los mismos datos. */
  | { kind: "uncertain"; message: string };

export function classifyExchangeError(error: unknown): ExchangeFailure {
  const info = apiErrorInfo(error, "");
  if (info.status && info.status >= 400 && info.status < 500) {
    return { kind: "rejected", message: info.message || "No se pudo registrar el cambio." };
  }
  if (info.status === 503) {
    return { kind: "uncertain", message: info.message || "El cambio quedó pendiente. Reintenta para ver cómo terminó." };
  }
  return {
    kind: "uncertain",
    message: "No pudimos confirmar si el cambio se registró. Reintenta con los mismos datos: si ya se registró, no se duplica.",
  };
}

export function newExchangeKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `exch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
