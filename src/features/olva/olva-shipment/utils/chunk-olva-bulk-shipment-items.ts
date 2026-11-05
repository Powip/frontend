import { OLVA_BULK_SHIPMENTS_MAX_SIZE } from "../constants/olva-shipment.constants";

/**
 * Splits a long list into lots of at most `size` (Olva's cap, 25). Send them one after the
 * other, not in parallel: each lot is one Olva call against the same rate limit.
 */
export function chunkOlvaBulkShipmentItems<T>(
  items: readonly T[],
  size: number = OLVA_BULK_SHIPMENTS_MAX_SIZE,
): T[][] {
  const chunkSize = Math.max(1, Math.min(Math.floor(size), OLVA_BULK_SHIPMENTS_MAX_SIZE));
  const chunks: T[][] = [];

  for (let start = 0; start < items.length; start += chunkSize) {
    chunks.push(items.slice(start, start + chunkSize));
  }

  return chunks;
}
