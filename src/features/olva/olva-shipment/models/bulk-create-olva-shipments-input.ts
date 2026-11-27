import type { CreateOlvaShipmentItemInput } from "./create-olva-shipment-input";

export type BulkOlvaShipmentItemInput = CreateOlvaShipmentItemInput & {
  /** Your own key for this shipment, unique in the lot (see `toOlvaBulkItems`). */
  itemKey: string;
};

export interface BulkCreateOlvaShipmentsInput {
  senderProfileId?: string;
  /** 1 to 25. For more, split with `chunkOlvaBulkShipmentItems`. */
  items: BulkOlvaShipmentItemInput[];
}
