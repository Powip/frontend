import type { OlvaShipmentSummary } from "@/features/olva/olva-shipment/models/olva-shipment";
import { isOlvaOrderReleased } from "@/features/olva/olva-shipment/utils/is-olva-order-released";

/**
 * Order id -> the shipment to show for it on a guide: the one that holds the order (only one can),
 * otherwise its newest one (a FAILED or DISCARDED attempt, a RETURNED package). Shipments made
 * without an order are left out.
 */
export function getOlvaShipmentByOrder(
  shipments: readonly OlvaShipmentSummary[],
): Map<string, OlvaShipmentSummary> {
  const byOrder = new Map<string, OlvaShipmentSummary>();

  for (const shipment of shipments) {
    const orderId = shipment.externalRef?.orderId;
    if (!orderId) continue;

    const current = byOrder.get(orderId);
    if (!current || ranksAbove(shipment, current)) byOrder.set(orderId, shipment);
  }

  return byOrder;
}

function ranksAbove(candidate: OlvaShipmentSummary, current: OlvaShipmentSummary): boolean {
  const candidateHolds = !isOlvaOrderReleased(candidate.status);
  const currentHolds = !isOlvaOrderReleased(current.status);

  if (candidateHolds !== currentHolds) return candidateHolds;
  return candidate.createdAt > current.createdAt;
}
