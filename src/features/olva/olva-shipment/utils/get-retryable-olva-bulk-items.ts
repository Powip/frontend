import { OLVA_SHIPMENT_ERROR_CODES } from "../constants/olva-shipment-error-codes.constants";
import type { BulkOlvaShipmentItemInput } from "../models/bulk-create-olva-shipments-input";
import type { OlvaBulkShipmentResult } from "../models/olva-bulk-shipment-result";

/**
 * The items of a lot that can be fixed and sent again: the ones where NOTHING was registered
 * (`failed`) and whose order is not already taken (SHIPMENT_ALREADY_EXISTS).
 *
 * Never included, on purpose:
 * - `created`: it is done.
 * - `registered_not_saved`: it exists at Olva and may be charged; sending it again would
 *   duplicate it.
 */
export function getRetryableOlvaBulkItems(
  items: readonly BulkOlvaShipmentItemInput[],
  results: readonly OlvaBulkShipmentResult[],
): BulkOlvaShipmentItemInput[] {
  const retryableKeys = new Set(
    results
      .filter(
        (result) =>
          result.status === "failed" &&
          result.error.code !== OLVA_SHIPMENT_ERROR_CODES.ALREADY_EXISTS,
      )
      .map((result) => result.itemKey),
  );

  return items.filter((item) => retryableKeys.has(item.itemKey));
}
