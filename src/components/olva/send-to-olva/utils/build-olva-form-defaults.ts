import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { OLVA_BULK_SHIPMENTS_MAX_SIZE } from "@/features/olva/olva-shipment/constants/olva-shipment.constants";
import type { BulkCreateOlvaShipmentsFormInput } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import { orderToOlvaFormItem } from "./order-to-olva-form-item";

interface BuildOlvaFormDefaultsOptions {
  guideId?: string;
  senderProfileId?: string;
}

/** Form values for a lot. A lot holds at most 25 shipments: the rest wait for the next one. */
export function buildOlvaFormDefaults(
  orders: readonly OrderDetail[],
  { guideId, senderProfileId }: BuildOlvaFormDefaultsOptions = {},
): BulkCreateOlvaShipmentsFormInput {
  return {
    senderProfileId,
    items: orders
      .slice(0, OLVA_BULK_SHIPMENTS_MAX_SIZE)
      .map((order) => orderToOlvaFormItem(order, { guideId })),
  };
}
