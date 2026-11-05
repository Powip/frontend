import { z } from "zod";
import {
  OLVA_BULK_ITEM_KEY_MAX_LENGTH,
  OLVA_BULK_SHIPMENTS_MAX_SIZE,
} from "../constants/olva-shipment.constants";
import {
  getOlvaShipmentItemIssues,
  olvaShipmentItemFields,
  withNarrowedOlvaDelivery,
} from "./olva-shipment-item.schema";

const bulkItemSchema = z
  .object({
    // The caller's own key for this shipment; every result is tied back to it
    itemKey: z
      .string({ error: "La clave del envío es obligatoria" })
      .trim()
      .min(1, { error: "La clave del envío es obligatoria" })
      .max(OLVA_BULK_ITEM_KEY_MAX_LENGTH, {
        error: `La clave del envío no puede superar los ${OLVA_BULK_ITEM_KEY_MAX_LENGTH} caracteres`,
      }),
    ...olvaShipmentItemFields,
  })
  .superRefine((item, ctx) => {
    for (const issue of getOlvaShipmentItemIssues(item)) {
      ctx.addIssue({ code: "custom", ...issue });
    }
  })
  // Valid by now: hand over the delivery fields as the union the request mapper takes
  .transform(withNarrowedOlvaDelivery);

export const bulkCreateOlvaShipmentsSchema = z
  .object({
    // The sender profile the whole lot goes out under; omitted means the default one
    senderProfileId: z.uuid({ error: "Remitente no válido" }).optional(),
    items: z
      .array(bulkItemSchema)
      .min(1, { error: "Agrega al menos un envío" })
      .max(OLVA_BULK_SHIPMENTS_MAX_SIZE, {
        error: `Un lote admite hasta ${OLVA_BULK_SHIPMENTS_MAX_SIZE} envíos`,
      }),
  })
  .superRefine((body, ctx) => {
    const itemKeys = new Set<string>();
    const orderIds = new Set<string>();

    body.items.forEach((item, index) => {
      if (itemKeys.has(item.itemKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "itemKey"],
          message: "La clave del envío está repetida en el lote",
        });
      }
      itemKeys.add(item.itemKey);

      const orderId = item.externalRef?.orderId;

      if (!orderId) return;

      if (orderIds.has(orderId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "externalRef", "orderId"],
          message: "El pedido está repetido en el lote",
        });
      }
      orderIds.add(orderId);
    });
  });

export type BulkCreateOlvaShipmentsFormInput = z.input<typeof bulkCreateOlvaShipmentsSchema>;
export type BulkCreateOlvaShipmentsFormValues = z.output<typeof bulkCreateOlvaShipmentsSchema>;
