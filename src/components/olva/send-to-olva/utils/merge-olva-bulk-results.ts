import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";

/**
 * Keeps one result per `itemKey` across the rounds of a lot: a retried item replaces its old
 * `failed` result, and what was already `created` stays on screen. First-seen order is kept.
 */
export function mergeOlvaBulkResults(
  previous: readonly OlvaBulkShipmentResult[],
  next: readonly OlvaBulkShipmentResult[],
): OlvaBulkShipmentResult[] {
  const byKey = new Map(previous.map((result) => [result.itemKey, result]));

  for (const result of next) byKey.set(result.itemKey, result);

  return [...byKey.values()];
}
