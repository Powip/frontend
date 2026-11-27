import type { OlvaShipmentSummary } from "@/features/olva/olva-shipment/models/olva-shipment";
import { isOlvaOrderReleased } from "@/features/olva/olva-shipment/utils/is-olva-order-released";

/**
 * Order id -> the shipment that holds it. DRAFT, REJECTED and RETURNED shipments do not hold
 * their order (it can be shipped again), so they are left out. The newest shipment wins.
 */
export function getOlvaActiveShipmentsByOrder(
  shipments: readonly OlvaShipmentSummary[],
): Map<string, OlvaShipmentSummary> {
  const byOrder = new Map<string, OlvaShipmentSummary>();

  for (const shipment of shipments) {
    const orderId = shipment.externalRef?.orderId;

    if (!orderId || isOlvaOrderReleased(shipment.status)) continue;

    const current = byOrder.get(orderId);

    if (!current || shipment.createdAt > current.createdAt) byOrder.set(orderId, shipment);
  }

  return byOrder;
}
