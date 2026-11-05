import { keepPreviousData, queryOptions, skipToken } from "@tanstack/react-query";
import { OLVA_SHIPMENT_STATUSES } from "../../shared/constants/olva-enums.constants";
import { shouldRetryOlvaRequest } from "../../shared/utils/should-retry-olva-request";
import {
  OLVA_SHIPMENT_DETAIL_STALE_TIME_MS,
  OLVA_SHIPMENT_LABEL_GC_TIME_MS,
  OLVA_SHIPMENT_LABEL_STALE_TIME_MS,
  OLVA_SHIPMENT_LIST_STALE_TIME_MS,
  OLVA_SHIPMENT_PAYMENT_POLL_INTERVAL_MS,
  OLVA_SHIPMENTS_BY_ORDER_LIMIT,
} from "../constants/olva-shipment.constants";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";
import {
  getOlvaShipment,
  getOlvaShipmentLabel,
  getOlvaShipments,
} from "../services/olva-shipment.service";
import { normalizeOlvaShipmentFilters } from "../utils/normalize-olva-shipment-filters";

export const olvaShipmentQueries = {
  list: (filters: OlvaShipmentFilters = {}) => {
    const normalized = normalizeOlvaShipmentFilters(filters);

    return queryOptions({
      queryKey: olvaShipmentKeys.list(normalized),
      queryFn: () => getOlvaShipments(normalized),
      // Changing page or filter keeps the old rows on screen until the new ones arrive
      placeholderData: keepPreviousData,
      staleTime: OLVA_SHIPMENT_LIST_STALE_TIME_MS,
      retry: shouldRetryOlvaRequest,
    });
  },

  /**
   * The shipment(s) made for one of the caller's orders. Idle for a blank order. The list also
   * holds released shipments (DRAFT, REJECTED, RETURNED): use `isOlvaOrderReleased` on them.
   */
  byOrder: (orderId: string | null | undefined) => {
    const normalized = orderId?.trim();

    return queryOptions({
      queryKey: olvaShipmentKeys.byOrder(normalized ?? ""),
      queryFn: normalized
        ? () => getOlvaShipments({ orderId: normalized, limit: OLVA_SHIPMENTS_BY_ORDER_LIMIT })
        : skipToken,
      staleTime: OLVA_SHIPMENT_LIST_STALE_TIME_MS,
      retry: shouldRetryOlvaRequest,
    });
  },

  detail: (id: string | null | undefined) =>
    queryOptions({
      queryKey: olvaShipmentKeys.detail(id ?? ""),
      queryFn: id ? () => getOlvaShipment(id) : skipToken,
      staleTime: OLVA_SHIPMENT_DETAIL_STALE_TIME_MS,
      retry: shouldRetryOlvaRequest,
      // Function form: polls only while the shipment waits for payment, and stops by itself
      // once it is paid (or expired), with no manual enable/disable.
      refetchInterval: (query) =>
        query.state.data?.status === OLVA_SHIPMENT_STATUSES.PENDING_PAYMENT
          ? OLVA_SHIPMENT_PAYMENT_POLL_INTERVAL_MS
          : false,
    }),

  label: (id: string | null | undefined) =>
    queryOptions({
      queryKey: olvaShipmentKeys.label(id ?? ""),
      queryFn: id ? () => getOlvaShipmentLabel(id) : skipToken,
      staleTime: OLVA_SHIPMENT_LABEL_STALE_TIME_MS,
      gcTime: OLVA_SHIPMENT_LABEL_GC_TIME_MS,
      retry: shouldRetryOlvaRequest,
    }),
};
