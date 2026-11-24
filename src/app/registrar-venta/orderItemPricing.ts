import { isTracked } from "@/services/inventoryTrackingService";
import type { CartItem, OrderItem } from "@/interfaces/IOrder";

type PricedCartItem = Pick<CartItem, "pvp" | "price" | "quantity" | "listPrice" | "lineTotal">;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** FEAT-32 M6a: línea con precio del motor (venta nueva): trae el precio de lista y el neto de la línea. */
export function isEnginePriced(item: Pick<CartItem, "listPrice" | "lineTotal">): item is { listPrice: number; lineTotal: number } {
  return typeof item.listPrice === "number" && Number.isFinite(item.listPrice) && typeof item.lineTotal === "number" && Number.isFinite(item.lineTotal);
}

export function getOrderItemPricing(item: PricedCartItem) {
  // FEAT-32 M6a: con motor, el bruto es el precio de lista y el descuento = promos + descuento manual.
  if (isEnginePriced(item)) {
    const unitPrice = round2(item.listPrice);
    const discountAmount = Math.max(0, round2(unitPrice * item.quantity - item.lineTotal));
    return {
      unitPrice,
      discountType: discountAmount > 0 ? ("FIXED" as const) : ("NONE" as const),
      discountAmount,
    };
  }
  // El precio manual puede superar el PVP original. Como el backend solo
  // representa descuentos positivos, ese precio pasa a ser el bruto de la línea.
  const unitPrice = Math.max(item.pvp ?? item.price, item.price);
  const discountAmount = Math.max(
    0,
    Math.round((unitPrice - item.price) * item.quantity * 100) / 100,
  );

  return {
    unitPrice,
    discountType: discountAmount > 0 ? ("FIXED" as const) : ("NONE" as const),
    discountAmount,
  };
}

/**
 * FEAT-32 M6a — origen del precio de la línea (`listPrice`, `promoId`, `promoDiscountAmount`).
 * - Con motor: lo que dio el motor.
 * - Pedido cargado (edición): se devuelve lo que trajo el GET, porque el PUT rehace las líneas. Si cambió la
 *   cantidad o el precio, la promo ya no describe la línea: queda solo el precio de lista.
 */
export function promoTraceOf(item: CartItem): { listPrice?: number; promoId?: string | null; promoDiscountAmount?: number } {
  if (isEnginePriced(item)) {
    return {
      listPrice: round2(item.listPrice),
      promoId: item.promoId ?? null,
      promoDiscountAmount: Math.max(0, round2(item.promoDiscountAmount ?? 0)),
    };
  }
  if (!item.promoTraceFor) return {};
  const unchanged = item.quantity === item.promoTraceFor.quantity && Math.abs(item.price - item.promoTraceFor.price) < 0.005;
  return {
    ...(typeof item.listPrice === "number" && Number.isFinite(item.listPrice) ? { listPrice: round2(item.listPrice) } : {}),
    ...(unchanged && item.promoId ? { promoId: item.promoId } : {}),
    ...(unchanged && item.promoDiscountAmount ? { promoDiscountAmount: round2(item.promoDiscountAmount) } : {}),
  };
}

const money = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? round2(number) : null;
};

/**
 * FEAT-32 M6a — al cargar un pedido para editarlo: su origen del precio (`list_price`, `promo_id`,
 * `promo_discount_amount`), con la cantidad y el precio a los que se refiere, para devolverlo en el PUT.
 */
export function loadedPromoTrace(
  item: Pick<OrderItem, "listPrice" | "promoId" | "promoDiscountAmount" | "quantity">,
  price: number,
): Pick<CartItem, "listPrice" | "promoId" | "promoDiscountAmount" | "promoTraceFor"> {
  const listPrice = money(item.listPrice);
  const promoId = typeof item.promoId === "string" && item.promoId ? item.promoId : null;
  const promoDiscountAmount = money(item.promoDiscountAmount) ?? 0;
  if (listPrice === null && !promoId && !promoDiscountAmount) return {};
  return { listPrice, promoId, promoDiscountAmount, promoTraceFor: { quantity: item.quantity, price } };
}

export function buildOrderItem(item: CartItem) {
  return {
    productVariantId: item.variantId,
    ...(isTracked(item.trackingMode) ? { unitIds: item.unitIds ?? [] } : {}),
    sku: item.sku,
    productName: item.productName,
    quantity: item.quantity,
    ...getOrderItemPricing(item),
    attributes: item.attributes,
    packId: item.packId ?? null,
    isGift: item.isGift ?? false,
    ...(item.isGift ? { giftValue: item.giftValue ?? 0 } : {}),
    ...promoTraceOf(item),
  };
}
