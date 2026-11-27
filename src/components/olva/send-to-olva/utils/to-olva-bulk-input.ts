import type { BulkCreateOlvaShipmentsInput } from "@/features/olva/olva-shipment/models/bulk-create-olva-shipments-input";
import type { BulkCreateOlvaShipmentsFormValues } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";

/**
 * The validated form is already shaped like the request: the schema narrowed each item to its
 * delivery type (pickup: agency; home: ubigeo + address + reference), so nothing is stripped here.
 * This only drops an unset sender.
 */
export function toOlvaBulkInput(
  values: BulkCreateOlvaShipmentsFormValues,
): BulkCreateOlvaShipmentsInput {
  return {
    ...(values.senderProfileId ? { senderProfileId: values.senderProfileId } : {}),
    items: values.items,
  };
}
