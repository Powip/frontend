import { z } from "zod";
import {
  getOlvaShipmentItemIssues,
  olvaShipmentItemFields,
  withNarrowedOlvaDelivery,
} from "./olva-shipment-item.schema";

export const createOlvaShipmentSchema = z
  .object({
    senderProfileId: z.uuid({ error: "Remitente no válido" }).optional(),
    ...olvaShipmentItemFields,
    // false only quotes the cart (DRAFT): no guide, no emails
    confirm: z.boolean().optional(),
  })
  .superRefine((item, ctx) => {
    for (const issue of getOlvaShipmentItemIssues(item)) {
      ctx.addIssue({ code: "custom", ...issue });
    }
  })
  // Valid by now: hand over the delivery fields as the union the request mapper takes
  .transform(withNarrowedOlvaDelivery);

export type CreateOlvaShipmentFormInput = z.input<typeof createOlvaShipmentSchema>;
export type CreateOlvaShipmentFormValues = z.output<typeof createOlvaShipmentSchema>;
