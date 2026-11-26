import type { OlvaShipment } from "./olva-shipment";
import type { OlvaShipmentLabel } from "./olva-shipment-label";

export interface OlvaBulkItemError {
  /** Stable code, see `OLVA_SHIPMENT_ERROR_CODES`. */
  code: string;
  message: string;
  details?: unknown;
}

interface OlvaBulkItemIdentity {
  itemKey: string;
}

/** Registered at Olva and stored here. */
export interface OlvaBulkShipmentCreated extends OlvaBulkItemIdentity {
  status: "created";
  shipment: OlvaShipment;
  /** Only available now: it is never stored. */
  label: OlvaShipmentLabel | null;
}

/**
 * Olva did not confirm the registration: it may exist at Olva. `shipment` is the reserved row
 * (SUBMITTING) the backend keeps verifying with the same key. NEVER send the item again: retry
 * the shipment instead (`useRetryOlvaShipment`).
 */
export interface OlvaBulkShipmentUnknown extends OlvaBulkItemIdentity {
  status: "unknown";
  shipment: OlvaShipment;
  error: OlvaBulkItemError;
}

/** Nothing was registered. Safe to fix and resend, unless the order already has a shipment. */
export interface OlvaBulkShipmentFailed extends OlvaBulkItemIdentity {
  status: "failed";
  error: OlvaBulkItemError;
  /** With SHIPMENT_ALREADY_EXISTS: the shipment that already holds the order; else the FAILED one. */
  existingShipment: OlvaShipment | null;
}

/** Narrow it with `result.status`. */
export type OlvaBulkShipmentResult =
  | OlvaBulkShipmentCreated
  | OlvaBulkShipmentUnknown
  | OlvaBulkShipmentFailed;

export interface OlvaBulkCreateShipmentsResult {
  summary: {
    total: number;
    created: number;
    unknown: number;
    failed: number;
  };
  /** One per shipment sent, in request order. */
  results: OlvaBulkShipmentResult[];
}
