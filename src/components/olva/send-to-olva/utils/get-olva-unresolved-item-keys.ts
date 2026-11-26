import { OLVA_SHIPMENT_ERROR_CODES } from "@/features/olva/olva-shipment/constants/olva-shipment-error-codes.constants";
import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";

/**
 * The orders still worth showing in the form after a round: the ones with no result yet and the
 * ones that failed with nothing registered (and whose order is not already taken). Never
 * `created`, never `registered_not_saved` (it exists at Olva: sending it again would duplicate it).
 */
export function getOlvaUnresolvedItemKeys(
  itemKeys: readonly string[],
  results: readonly OlvaBulkShipmentResult[],
): string[] {
  const resultByKey = new Map(results.map((result) => [result.itemKey, result]));

  return itemKeys.filter((itemKey) => {
    const result = resultByKey.get(itemKey);

    if (!result) return true;

    return (
      result.status === "failed" && result.error.code !== OLVA_SHIPMENT_ERROR_CODES.ALREADY_EXISTS
    );
  });
}
