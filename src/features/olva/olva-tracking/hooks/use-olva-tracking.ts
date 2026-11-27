import { useQuery } from "@tanstack/react-query";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";
import { olvaTrackingQueries } from "../queries/olva-tracking.queries";

/**
 * Tracks one guide. Pass `null` (or an invalid guide) to keep it idle. A 404 comes back as
 * `error`: use `isOlvaNotFoundError` to tell "that guide does not exist" from a real failure.
 */
export function useOlvaTracking(lookup: OlvaTrackingLookup | null) {
  return useQuery(olvaTrackingQueries.single(lookup));
}
