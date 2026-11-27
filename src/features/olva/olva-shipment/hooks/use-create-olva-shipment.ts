import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type { CreateOlvaShipmentInput } from "../models/create-olva-shipment-input";
import type { OlvaCreatedShipment } from "../models/olva-created-shipment";
import { createOlvaShipment } from "../services/olva-shipment.service";
import { getOlvaShipmentErrorMessage } from "../utils/olva-shipment-error.util";

/**
 * Creates a shipment (the guide Olva prints). Retrying after a failure is safe: the backend
 * stores each order's shipment before calling Olva, so a second attempt for the same order
 * answers ALREADY_EXISTS (or OLVA_OUTCOME_UNKNOWN while it is being verified), never a second guide.
 */
export function useCreateOlvaShipment() {
  const queryClient = useQueryClient();

  return useMutation<OlvaCreatedShipment, Error, CreateOlvaShipmentInput>({
    mutationFn: createOlvaShipment,
    onSuccess: (shipment) => {
      // Keep the label out of the cache: it is heavy and the caller already received it
      const { label: _label, ...detail } = shipment;
      queryClient.setQueryData(olvaShipmentKeys.detail(shipment.id), detail);
      queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.lists() });
      toast.success("Envío creado correctamente.");
    },
    onError: (error: Error) => {
      toast.error(getOlvaShipmentErrorMessage(error));
    },
  });
}
