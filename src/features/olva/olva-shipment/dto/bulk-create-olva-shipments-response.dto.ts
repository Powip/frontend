import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";
import type { OLVA_BULK_ITEM_STATUSES } from "../constants/olva-shipment.constants";
import type {
  OlvaShipmentLabelResponseDto,
  OlvaShipmentPaymentResponseDto,
  OlvaShipmentResponseDto,
} from "./olva-shipment-response.dto";

export interface OlvaBulkShipmentItemErrorResponseDto {
  /** Stable code: SHIPMENT_ALREADY_EXISTS, SHIPMENT_ORIGIN_DOES_NOT_ACCEPT_PAYMENT, ... */
  code: string;
  message: string;
  details?: unknown;
}

// Only for `registered_not_saved`: the ids by which Olva knows a shipment we could not store
export interface OlvaBulkRegisteredInOlvaResponseDto {
  id: string;
  registrationNumber: string | null;
  trackingNumber: string | null;
  status: OlvaShipmentStatus;
  cost: number;
  igv: number | null;
  /** whoPays ONLINE: how to pay it, since there is no stored shipment to carry it. */
  payment: OlvaShipmentPaymentResponseDto | null;
}

export type OlvaBulkItemStatusResponse =
  (typeof OLVA_BULK_ITEM_STATUSES)[keyof typeof OLVA_BULK_ITEM_STATUSES];

export interface OlvaBulkShipmentItemResponseDto {
  itemKey: string;
  status: OlvaBulkItemStatusResponse;
  /**
   * created: the stored shipment (payment inside, for ONLINE).
   * failed with SHIPMENT_ALREADY_EXISTS: the shipment that already holds the order.
   */
  shipment: OlvaShipmentResponseDto | null;
  /** Never stored: this response is the only time it is available. */
  label: OlvaShipmentLabelResponseDto | null;
  registeredInOlva: OlvaBulkRegisteredInOlvaResponseDto | null;
  error: OlvaBulkShipmentItemErrorResponseDto | null;
}

// POST /olva/shipments/bulk -> 200, even when some items fail: the detail is in `results`
export interface BulkCreateOlvaShipmentsResponseDto {
  summary: {
    total: number;
    created: number;
    registeredNotSaved: number;
    failed: number;
  };
  /** One per shipment sent, in request order. */
  results: OlvaBulkShipmentItemResponseDto[];
}
