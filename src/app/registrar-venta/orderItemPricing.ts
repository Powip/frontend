import type { CartItem } from "@/interfaces/IOrder";

type PricedCartItem = Pick<CartItem, "pvp" | "price" | "quantity">;

export function getOrderItemPricing(item: PricedCartItem) {
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

export function buildOrderItem(item: CartItem) {
  return {
    productVariantId: item.variantId,
    sku: item.sku,
    productName: item.productName,
    quantity: item.quantity,
    ...getOrderItemPricing(item),
    attributes: item.attributes,
    packId: item.packId ?? null,
    isGift: item.isGift ?? false,
    ...(item.isGift ? { giftValue: item.giftValue ?? 0 } : {}),
  };
}
