import { omitEmptyOlvaValues } from "../../shared/utils/omit-empty-olva-values";
import type { BulkCreateOlvaShipmentsRequestDto } from "../dto/bulk-create-olva-shipments-request.dto";
import type { BulkCreateOlvaShipmentsInput } from "../models/bulk-create-olva-shipments-input";
import { toOlvaShipmentItemRequestDto } from "./to-olva-shipment-item-request.dto";

/** Lot -> POST /olva/shipments/bulk body. Items carry no `confirm`: a lot always registers. */
export function toBulkCreateOlvaShipmentsRequestDto(
  input: BulkCreateOlvaShipmentsInput,
): BulkCreateOlvaShipmentsRequestDto {
  return {
    ...omitEmptyOlvaValues({ senderProfileId: input.senderProfileId }),
    items: input.items.map((item) => ({
      itemKey: item.itemKey.trim(),
      ...toOlvaShipmentItemRequestDto(item),
    })),
  };
}
