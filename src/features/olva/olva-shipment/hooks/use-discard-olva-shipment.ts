import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type { OlvaShipment } from "../models/olva-shipment";
import { discardOlvaShipment } from "../services/olva-shipment.service";
import { getOlvaShipmentErrorMessage } from "../utils/olva-shipment-error.util";

/** «Descartar» a shipment whose payment expired: the order is free to be registered again. */
export function useDiscardOlvaShipment(): UseMutationResult<OlvaShipment, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: discardOlvaShipment,
    onSuccess: (shipment) => {
      queryClient.setQueryData(olvaShipmentKeys.detail(shipment.id), shipment);
      queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.lists() });
      toast.success("Envío descartado. Ya puedes registrar el pedido de nuevo.");
    },
    onError: (error: Error) => {
      toast.error(getOlvaShipmentErrorMessage(error));
    },
  });
}
