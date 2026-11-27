import type { OlvaShipmentItemRequestDto } from "./olva-shipment-item-request.dto";

export type BulkOlvaShipmentItemRequestDto = OlvaShipmentItemRequestDto & {
  /** The caller's own key for this shipment (unique in the lot); every result is tied to it. */
  itemKey: string;
};

// POST /olva/shipments/bulk (strict). There is NO Idempotency-Key: duplicates are prevented by
// order, so each item should carry `externalRef.orderId` (unique inside the lot).
export interface BulkCreateOlvaShipmentsRequestDto {
  /** The sender profile the whole lot goes out under. Omitted = the company's default one. */
  senderProfileId?: string;
  /** 1 to 25 shipments. */
  items: BulkOlvaShipmentItemRequestDto[];
}
