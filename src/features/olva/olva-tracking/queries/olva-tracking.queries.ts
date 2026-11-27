import { keepPreviousData, queryOptions, skipToken } from "@tanstack/react-query";
import { isOlvaShipmentFinal } from "../../olva-shipment/utils/is-olva-shipment-final";
import { shouldRetryOlvaRequest } from "../../shared/utils/should-retry-olva-request";
import {
  OLVA_TRACKING_BATCH_MAX_SIZE,
  OLVA_TRACKING_GC_TIME_MS,
  OLVA_TRACKING_REFETCH_INTERVAL_MS,
  OLVA_TRACKING_STALE_TIME_MS,
} from "../constants/olva-tracking.constants";
import { olvaTrackingKeys } from "../keys/olva-tracking.keys";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";
import { trackOlvaShipment, trackOlvaShipmentsBatch } from "../services/olva-tracking.service";
import { isValidOlvaTrackingLookup } from "../utils/is-valid-olva-tracking-lookup";
import { normalizeOlvaTrackingLookups } from "../utils/normalize-olva-tracking-lookups";

const EMPTY_LOOKUP: OlvaTrackingLookup = { orderNumber: "" };

const shared = {
  gcTime: OLVA_TRACKING_GC_TIME_MS,
  // A 404 ("guide not found") is an answer, not a failure worth retrying
  retry: shouldRetryOlvaRequest,
} as const;

export const olvaTrackingQueries = {
  /** Idle for `null` or a malformed guide: no request is spent on input that cannot match. */
  single: (lookup: OlvaTrackingLookup | null) =>
    queryOptions({
      queryKey: olvaTrackingKeys.single(lookup ?? EMPTY_LOOKUP),
      queryFn:
        lookup && isValidOlvaTrackingLookup(lookup) ? () => trackOlvaShipment(lookup) : skipToken,
      // A delivered/returned/rejected guide will not change anymore: never refetch it. The
      // others go stale in a minute and are re-read every few minutes while the screen is open.
      staleTime: (query) =>
        query.state.data && isOlvaShipmentFinal(query.state.data.status)
          ? Number.POSITIVE_INFINITY
          : OLVA_TRACKING_STALE_TIME_MS,
      refetchInterval: (query) =>
        query.state.data && isOlvaShipmentFinal(query.state.data.status)
          ? false
          : OLVA_TRACKING_REFETCH_INTERVAL_MS,
      ...shared,
    }),

  /**
   * A batch is a read-only POST, so it is a query. Idle while the list is empty, over the
   * backend maximum or has a malformed guide: callers should `normalizeOlvaTrackingLookups`.
   */
  batch: (lookups: readonly OlvaTrackingLookup[] | null) => {
    const list = lookups ?? [];
    const runnable =
      list.length > 0 &&
      list.length <= OLVA_TRACKING_BATCH_MAX_SIZE &&
      list.every(isValidOlvaTrackingLookup);

    return queryOptions({
      queryKey: olvaTrackingKeys.batch(normalizeOlvaTrackingLookups(list)),
      queryFn: runnable
        ? () => trackOlvaShipmentsBatch(normalizeOlvaTrackingLookups(list))
        : skipToken,
      placeholderData: keepPreviousData,
      staleTime: OLVA_TRACKING_STALE_TIME_MS,
      ...shared,
    });
  },
};
