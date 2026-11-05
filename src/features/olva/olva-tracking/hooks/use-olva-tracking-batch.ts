import { useQuery } from "@tanstack/react-query";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";
import { olvaTrackingQueries } from "../queries/olva-tracking.queries";

/**
 * Tracks up to 50 guides in one request. The request succeeds even when some guides fail:
 * each failed one comes back as `{ success: false, error }` (see `splitOlvaTrackingBatch`).
 * Duplicates are removed before sending.
 */
export function useOlvaTrackingBatch(lookups: readonly OlvaTrackingLookup[] | null) {
  return useQuery(olvaTrackingQueries.batch(lookups));
}
