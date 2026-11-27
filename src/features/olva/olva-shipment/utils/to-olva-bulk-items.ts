import type { BulkOlvaShipmentItemInput } from "../models/bulk-create-olva-shipments-input";
import type { CreateOlvaShipmentItemInput } from "../models/create-olva-shipment-input";

/**
 * Gives each shipment its `itemKey`: its order id when it has one (so results read naturally),
 * otherwise its position ("item-1", "item-2"...). Keys must be unique within the lot, so a
 * repeated order falls back to the position key too.
 */
export function toOlvaBulkItems(
  items: readonly CreateOlvaShipmentItemInput[],
): BulkOlvaShipmentItemInput[] {
  const used = new Set<string>();

  return items.map((item, index) => {
    const orderId = item.externalRef?.orderId?.trim();
    const itemKey = orderId && !used.has(orderId) ? orderId : `item-${index + 1}`;

    used.add(itemKey);

    return { ...item, itemKey };
  });
}
