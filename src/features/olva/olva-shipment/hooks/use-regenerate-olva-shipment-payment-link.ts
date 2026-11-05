import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type { OlvaShipment } from "../models/olva-shipment";
import { regenerateOlvaShipmentPaymentLink } from "../services/olva-shipment.service";
import { getOlvaShipmentErrorMessage } from "../utils/olva-shipment-error.util";

/**
 * Asks Olva for a new payment link. Olva allows only a few per shipment every 10 minutes, so
 * only offer it when `canRegenerateOlvaPaymentLink(status)` is true.
 */
export function useRegenerateOlvaShipmentPaymentLink(): UseMutationResult<
  OlvaShipment,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: regenerateOlvaShipmentPaymentLink,

    onSuccess: (shipment) => {
      // The answer is the freshest copy of the shipment: no need to refetch the detail
      queryClient.setQueryData(olvaShipmentKeys.detail(shipment.id), shipment);
      queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.lists() });

      toast.success("Generamos un nuevo link de pago.");
    },

    onError: (error: Error) => {
      toast.error(getOlvaShipmentErrorMessage(error));
    },
  });
}
