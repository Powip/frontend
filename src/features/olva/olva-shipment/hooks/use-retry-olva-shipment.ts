import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getOlvaErrorCode } from "../../shared/utils/olva-error.util";
import { OLVA_SHIPMENT_ERROR_CODES } from "../constants/olva-shipment-error-codes.constants";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type { RetryOlvaShipmentVariables } from "../models/create-olva-shipment-input";
import type { OlvaBulkShipmentResult } from "../models/olva-bulk-shipment-result";
import { retryOlvaShipment } from "../services/olva-shipment.service";
import {
  getOlvaShipmentErrorMessage,
  OLVA_SHIPMENT_ERROR_MESSAGES,
} from "../utils/olva-shipment-error.util";

/**
 * «Reintentar» a registration Olva did not confirm (SUBMITTING). Past an hour the backend answers
 * SHIPMENT_MANUAL_REVIEW: that error is left to the screen, which asks the store to check the guide
 * at Olva and then retries with `confirmed: true`.
 */
export function useRetryOlvaShipment(): UseMutationResult<
  OlvaBulkShipmentResult,
  Error,
  RetryOlvaShipmentVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryOlvaShipment,
    onSuccess: (result) => {
      const shipment = result.status === "failed" ? result.existingShipment : result.shipment;
      if (shipment) queryClient.setQueryData(olvaShipmentKeys.detail(shipment.id), shipment);
      queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.lists() });

      if (result.status === "created") toast.success("Olva confirmó el envío.");
      else if (result.status === "unknown")
        toast.warning(
          "Olva todavía no lo confirma. Lo seguimos verificando: no lo registres de nuevo.",
        );
      else toast.error(OLVA_SHIPMENT_ERROR_MESSAGES[result.error.code] ?? result.error.message);
    },
    onError: (error: Error) => {
      if (getOlvaErrorCode(error) === OLVA_SHIPMENT_ERROR_CODES.MANUAL_REVIEW) return;
      toast.error(getOlvaShipmentErrorMessage(error));
    },
  });
}
