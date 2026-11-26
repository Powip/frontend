import type { ValueOf } from "../../shared/types/value-of.type";

/**
 * Codes of the shipment flows, in `details.code` of an error response or in `error.code` of a bulk
 * item. Mirrors ms-integrations: src/olva/domain/shipments/shipment.errors.ts
 */
export const OLVA_SHIPMENT_ERROR_CODES = {
  /** The order already has an active Olva shipment in this company. */
  ALREADY_EXISTS: "SHIPMENT_ALREADY_EXISTS",
  /** The origin headquarter is not in Olva's catalog. */
  ORIGIN_NOT_FOUND: "SHIPMENT_ORIGIN_NOT_FOUND",
  /** The origin headquarter does not offer the chosen `whoPays` / payment method. */
  ORIGIN_DOES_NOT_ACCEPT_PAYMENT: "SHIPMENT_ORIGIN_DOES_NOT_ACCEPT_PAYMENT",
  /** The destination ubigeo code of a home delivery is not in Olva's ubigeo catalog. */
  DESTINATION_UBIGEO_NOT_FOUND: "SHIPMENT_DESTINATION_UBIGEO_NOT_FOUND",
  /**
   * The payment provider (e.g. PagoEfectivo) is down, so no payment could be created. The API
   * answers 503 with this code; the user can retry or pick another payment method (Niubiz).
   */
  PAYMENT_PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  /** Olva registered the shipment but we could not save it: do NOT retry, it would duplicate. */
  NOT_PERSISTED: "SHIPMENT_NOT_PERSISTED",
  /** Olva refused this item of a bulk request. */
  REJECTED_BY_OLVA: "SHIPMENT_REJECTED_BY_OLVA",
} as const;

export type OlvaShipmentErrorCode = ValueOf<typeof OLVA_SHIPMENT_ERROR_CODES>;
