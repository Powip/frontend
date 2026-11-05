import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";
import type { OlvaShipment, OlvaShipmentPayment } from "./olva-shipment";
import type { OlvaShipmentLabel } from "./olva-shipment-label";

export interface OlvaBulkItemError {
  /** Stable code, see `OLVA_SHIPMENT_ERROR_CODES`. */
  code: string;
  message: string;
  details?: unknown;
}

/** The ids by which Olva knows a shipment that could not be stored here. */
export interface OlvaRegisteredInOlva {
  id: string;
  registrationNumber: string | null;
  trackingNumber: string | null;
  status: OlvaShipmentStatus;
  cost: number;
  igv: number | null;
  payment: OlvaShipmentPayment | null;
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
 * Registered at Olva but not saved here. It exists and may be charged: NEVER send it again.
 * Show `registeredInOlva` (and the label) so the user can follow it up.
 */
export interface OlvaBulkShipmentRegisteredNotSaved extends OlvaBulkItemIdentity {
  status: "registered_not_saved";
  registeredInOlva: OlvaRegisteredInOlva;
  label: OlvaShipmentLabel | null;
}

/** Nothing was registered. Safe to fix and resend, unless the order already has a shipment. */
export interface OlvaBulkShipmentFailed extends OlvaBulkItemIdentity {
  status: "failed";
  error: OlvaBulkItemError;
  /** With SHIPMENT_ALREADY_EXISTS: the shipment that already holds the order. */
  existingShipment: OlvaShipment | null;
}

/** Narrow it with `result.status`. */
export type OlvaBulkShipmentResult =
  | OlvaBulkShipmentCreated
  | OlvaBulkShipmentRegisteredNotSaved
  | OlvaBulkShipmentFailed;

export interface OlvaBulkCreateShipmentsResult {
  summary: {
    total: number;
    created: number;
    registeredNotSaved: number;
    failed: number;
  };
  /** One per shipment sent, in request order. */
  results: OlvaBulkShipmentResult[];
}
