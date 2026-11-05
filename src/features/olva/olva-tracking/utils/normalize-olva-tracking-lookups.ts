import { OLVA_TRACKING_BATCH_MAX_SIZE } from "../constants/olva-tracking.constants";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";
import { isValidOlvaTrackingLookup } from "./is-valid-olva-tracking-lookup";

/**
 * Cleans a user-entered list for a batch: trims, drops blank `orderCode`, removes duplicates
 * (keeping the first, so request order stays stable) and cuts it at the backend's maximum.
 * Entries that are not valid guides are left out; validate them first to tell the user.
 */
export function normalizeOlvaTrackingLookups(
  lookups: readonly OlvaTrackingLookup[],
): OlvaTrackingLookup[] {
  const seen = new Set<string>();
  const result: OlvaTrackingLookup[] = [];

  for (const lookup of lookups) {
    if (!isValidOlvaTrackingLookup(lookup)) continue;

    const orderNumber = lookup.orderNumber.trim();
    const orderCode = lookup.orderCode?.trim() || undefined;
    const identity = `${orderNumber}:${orderCode ?? ""}`;

    if (seen.has(identity)) continue;

    seen.add(identity);
    result.push(orderCode ? { orderNumber, orderCode } : { orderNumber });

    if (result.length === OLVA_TRACKING_BATCH_MAX_SIZE) break;
  }

  return result;
}
