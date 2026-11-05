import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import type { OlvaShipmentLabel } from "@/features/olva/olva-shipment/models/olva-shipment-label";

export interface CollectedOlvaLabels {
  /** In the order of the lot. */
  labels: OlvaShipmentLabel[];
  /** The orders whose label could not be obtained. */
  missingItemKeys: string[];
}

/**
 * The Olva label of every shipment that exists in Olva (created, or registered but not saved).
 * The label that came with the creation answer is used as it is; otherwise Olva is asked for it.
 * One label that cannot be obtained does not stop the others.
 */
export async function collectOlvaLabels(
  results: readonly OlvaBulkShipmentResult[],
  fetchLabel: (shipmentId: string) => Promise<OlvaShipmentLabel>,
): Promise<CollectedOlvaLabels> {
  const settled = await Promise.all(
    results.map(async (result) => {
      if (result.status === "failed") return null;

      if (result.label) return { itemKey: result.itemKey, label: result.label };

      const shipmentId =
        result.status === "created" ? result.shipment.id : result.registeredInOlva.id;

      try {
        return { itemKey: result.itemKey, label: await fetchLabel(shipmentId) };
      } catch {
        return { itemKey: result.itemKey, label: null };
      }
    }),
  );

  const labels: OlvaShipmentLabel[] = [];
  const missingItemKeys: string[] = [];

  for (const entry of settled) {
    if (!entry) continue;

    if (entry.label) labels.push(entry.label);
    else missingItemKeys.push(entry.itemKey);
  }

  return { labels, missingItemKeys };
}
