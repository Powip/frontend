import type { OLVA_BULK_ITEM_STATUSES } from "../constants/olva-shipment.constants";
import type {
  OlvaShipmentLabelResponseDto,
  OlvaShipmentResponseDto,
} from "./olva-shipment-response.dto";

export interface OlvaBulkShipmentItemErrorResponseDto {
  /** Stable code: SHIPMENT_ALREADY_EXISTS, SHIPMENT_ORIGIN_DOES_NOT_ACCEPT_PAYMENT, ... */
  code: string;
  message: string;
  details?: unknown;
}

export type OlvaBulkItemStatusResponse =
  (typeof OLVA_BULK_ITEM_STATUSES)[keyof typeof OLVA_BULK_ITEM_STATUSES];

export interface OlvaBulkShipmentItemResponseDto {
  itemKey: string;
  status: OlvaBulkItemStatusResponse;
  /**
   * created: the stored shipment (payment inside, for ONLINE).
   * unknown (OLVA_OUTCOME_UNKNOWN): the reserved shipment (SUBMITTING) being verified.
   * failed: the shipment that already holds the order (SHIPMENT_ALREADY_EXISTS), or the FAILED one.
   */
  shipment: OlvaShipmentResponseDto | null;
  /** Never stored: this response is the only time it is available. */
  label: OlvaShipmentLabelResponseDto | null;
  error: OlvaBulkShipmentItemErrorResponseDto | null;
}

// POST /olva/shipments/bulk -> 200, even when some items fail: the detail is in `results`
export interface BulkCreateOlvaShipmentsResponseDto {
  summary: {
    total: number;
    created: number;
    unknown: number;
    failed: number;
  };
  /** One per shipment sent, in request order. */
  results: OlvaBulkShipmentItemResponseDto[];
}
