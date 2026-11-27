import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";

/** What the lot costs: the real cost of each shipment Olva registered (not an equal split). */
export function getOlvaResultsCost(results: readonly OlvaBulkShipmentResult[]): number {
  return results.reduce((total, result) => {
    if (result.status === "created") return total + result.shipment.cost;
    return total;
  }, 0);
}
