import { omitEmptyOlvaValues } from "../../shared/utils/omit-empty-olva-values";
import type { CreateOlvaShipmentRequestDto } from "../dto/create-olva-shipment-request.dto";
import type { CreateOlvaShipmentInput } from "../models/create-olva-shipment-input";
import { toOlvaShipmentItemRequestDto } from "./to-olva-shipment-item-request.dto";

/** Form input -> POST /olva/shipments body (the item plus `senderProfileId` and `confirm`). */
export function toCreateOlvaShipmentRequestDto(
  input: CreateOlvaShipmentInput,
): CreateOlvaShipmentRequestDto {
  return {
    ...omitEmptyOlvaValues({
      senderProfileId: input.senderProfileId,
      confirm: input.confirm,
    }),
    ...toOlvaShipmentItemRequestDto(input),
  };
}
