import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { olvaShipmentKeys } from "../keys/olva-shipment.keys";
import type {
  CreateOlvaShipmentInput,
  CreateOlvaShipmentVariables,
} from "../models/create-olva-shipment-input";
import type { OlvaCreatedShipment } from "../models/olva-created-shipment";
import { createOlvaShipment } from "../services/olva-shipment.service";
import { createOlvaIdempotencyKey } from "../utils/create-olva-idempotency-key";
import { getOlvaShipmentErrorMessage } from "../utils/olva-shipment-error.util";

/**
 * Creates a shipment (the guide Olva prints) with an idempotency key.
 *
 * The key lives as long as the user's intent: it is created on the first attempt and REUSED when
 * that attempt fails (timeout, 5xx), so retrying can never create a second shipment. It is
 * dropped after a success or an explicit `reset()`. Call `reset()` when the user edits the
 * form after an error: a changed body is a new intent and needs a new key.
 */
export function useCreateOlvaShipment() {
  const queryClient = useQueryClient();
  const keyRef = useRef<string | null>(null);

  const mutation = useMutation<OlvaCreatedShipment, Error, CreateOlvaShipmentVariables>({
    mutationFn: createOlvaShipment,

    onSuccess: (shipment) => {
      keyRef.current = null;

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

  const withKey = (input: CreateOlvaShipmentInput): CreateOlvaShipmentVariables => {
    keyRef.current ??= createOlvaIdempotencyKey();

    return { input, idempotencyKey: keyRef.current };
  };

  return {
    ...mutation,
    mutate: (input: CreateOlvaShipmentInput, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate(withKey(input), options),
    mutateAsync: (
      input: CreateOlvaShipmentInput,
      options?: Parameters<typeof mutation.mutateAsync>[1],
    ) => mutation.mutateAsync(withKey(input), options),
    reset: () => {
      keyRef.current = null;
      mutation.reset();
    },
  };
}
