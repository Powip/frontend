import { useBulkCreateOlvaShipments } from "@/features/olva/olva-shipment/hooks/use-bulk-create-olva-shipments";
import type { OlvaBulkCreateShipmentsResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import type { BulkCreateOlvaShipmentsFormValues } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import { toOlvaBulkInput } from "../utils/to-olva-bulk-input";

interface UseSendToOlvaSubmitOptions {
  onResult: (result: OlvaBulkCreateShipmentsResult) => void;
}

/**
 * Sends the lot. The call answers even when some shipments fail, so every outcome goes to
 * `onResult`; only a failure of the WHOLE call rejects, and the mutation already told the user
 * (toast), so nothing is thrown here and the form stays as it was.
 */
export function useSendToOlvaSubmit({ onResult }: UseSendToOlvaSubmitOptions) {
  const { mutateAsync, isPending } = useBulkCreateOlvaShipments();

  const submit = async (values: BulkCreateOlvaShipmentsFormValues) => {
    try {
      onResult(await mutateAsync(toOlvaBulkInput(values)));
    } catch {
      // Reported by the mutation's onError
    }
  };

  return { submit, isSubmitting: isPending };
}
