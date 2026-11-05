import type { OlvaShipmentItemRequestDto } from "./olva-shipment-item-request.dto";

// POST /olva/shipments (strict: unknown keys are rejected, so `sender` must NOT be sent; it comes
// from the sender profile). Header `Idempotency-Key` is sent apart from the body.
export type CreateOlvaShipmentRequestDto = OlvaShipmentItemRequestDto & {
  /** Omitted = the company's default sender profile. */
  senderProfileId?: string;
  /** false only quotes the cart (status DRAFT): no guide, no emails. */
  confirm?: boolean;
};
