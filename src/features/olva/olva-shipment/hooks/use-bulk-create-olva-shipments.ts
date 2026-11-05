import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OLVA_ERROR_CODES } from "../../shared/constants/olva-error-codes.constants";
import { getOlvaErrorCode } from "../../shared/utils/olva-error.util";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type { BulkCreateOlvaShipmentsInput } from "../models/bulk-create-olva-shipments-input";
import type { OlvaBulkCreateShipmentsResult } from "../models/olva-bulk-shipment-result";
import { bulkCreateOlvaShipments } from "../services/olva-shipment.service";
import { getOlvaBulkSummaryMessage } from "../utils/get-olva-bulk-summary-message";
import { getOlvaShipmentErrorMessage } from "../utils/olva-shipment-error.util";

/**
 * Creates up to 25 shipments in one call (`chunkOlvaBulkShipmentItems` splits longer lists).
 *
 * The call succeeds even when some shipments fail: read `result.results` (or `splitOlvaBulkResults`)
 * to see what happened to each. Only a failure of the WHOLE call (plan, rate limit, timeout)
 * rejects.
 *
 * There is no idempotency key: do not resend items that are `created` or `registered_not_saved`
 * (use `getRetryableOlvaBulkItems`). The mutation never retries by itself.
 */
export function useBulkCreateOlvaShipments(): UseMutationResult<
  OlvaBulkCreateShipmentsResult,
  Error,
  BulkCreateOlvaShipmentsInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkCreateOlvaShipments,

    onSuccess: ({ summary, results }) => {
      for (const result of results) {
        // A cached detail avoids a refetch when the user opens one. The label is NOT cached: it
        // is heavy, and the caller already has it in the mutation result.
        if (result.status === "created") {
          queryClient.setQueryData(olvaShipmentKeys.detail(result.shipment.id), result.shipment);
        } else if (result.status === "failed" && result.existingShipment) {
          queryClient.setQueryData(
            olvaShipmentKeys.detail(result.existingShipment.id),
            result.existingShipment,
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.lists() });

      const { tone, message } = getOlvaBulkSummaryMessage(summary);

      if (tone === "success") toast.success(message);
      else if (tone === "warning") toast.warning(message);
      else toast.error(message);
    },

    onError: (error: Error) => {
      // The outcome is unknown: some shipments may exist. Refresh so the user can see them.
      if (getOlvaErrorCode(error) === OLVA_ERROR_CODES.OUTCOME_UNKNOWN) {
        queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.lists() });
      }

      toast.error(getOlvaShipmentErrorMessage(error));
    },
  });
}
