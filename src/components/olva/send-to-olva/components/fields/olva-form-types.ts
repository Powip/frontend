import type { FieldPath } from "react-hook-form";
import type { BulkCreateOlvaShipmentsFormInput } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";

/** The values the whole modal form holds (the lot). */
export type SendToOlvaFormValues = BulkCreateOlvaShipmentsFormInput;

export type SendToOlvaFieldName = FieldPath<SendToOlvaFormValues>;
