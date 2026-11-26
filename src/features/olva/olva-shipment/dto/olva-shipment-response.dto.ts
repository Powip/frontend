import type {
  OLVA_PAYMENT_METHODS,
  OlvaCurrency,
  OlvaDeliveryType,
  OlvaShipmentStatus,
  OlvaWhoPays,
} from "../../shared/constants/olva-enums.constants";

export interface OlvaShipmentLabelResponseDto {
  filename: string;
  mimeType: string;
  /** The PDF, base64 encoded. */
  pdfBase64: string;
}

// What every payment has. Which fields come filled depends on the flow: creation returns
// amount/currency/expiresAt plus the method's own fields; reading adds paid/expired/
// gatewayStatus/checkedAt/stale.
interface OlvaShipmentPaymentBaseResponseDto {
  amount?: number;
  currency?: OlvaCurrency;
  /** ISO date-time. */
  expiresAt?: string;
  paid?: boolean;
  expired?: boolean;
  gatewayStatus?: string;
  /** ISO date-time. */
  checkedAt?: string;
  /** True when Olva could not be asked and the last known state is shown. */
  stale?: boolean;
}

/** A link / CIP the customer pays outside our front. */
export interface OlvaPagoEfectivoPaymentResponseDto extends OlvaShipmentPaymentBaseResponseDto {
  method: typeof OLVA_PAYMENT_METHODS.PAGOEFECTIVO;
  url?: string;
  cipCode?: string;
  hoursAvailable?: number;
  qrImage?: string;
}

/**
 * A card checkout session, not a link: load `checkoutScriptUrl` and open the form with
 * `sessionKey` and `merchantId`. Absent once the shipment is paid or the session expired.
 * It is a short-lived credential: do not store or log it.
 */
export interface OlvaNiubizPaymentResponseDto extends OlvaShipmentPaymentBaseResponseDto {
  method: typeof OLVA_PAYMENT_METHODS.NIUBIZ;
  sessionKey?: string;
  merchantId?: string;
  checkoutScriptUrl?: string;
}

/** A method Olva adds later: only the base fields, so a new method cannot break a shipment. */
export interface OlvaOtherPaymentResponseDto extends OlvaShipmentPaymentBaseResponseDto {
  method: string;
}

/** Switch on `method`: each variant carries exactly the fields of its method. */
export type OlvaShipmentPaymentResponseDto =
  | OlvaPagoEfectivoPaymentResponseDto
  | OlvaNiubizPaymentResponseDto
  | OlvaOtherPaymentResponseDto;

// The caller's own references, echoed back so a screen can match shipments to orders
export interface OlvaShipmentExternalRefResponseDto {
  orderId: string;
  guideId: string | null;
}

export interface OlvaShipmentListItemResponseDto {
  id: string;
  internalId: string | null;
  trackingNumber: string | null;
  registrationNumber: string | null;
  status: OlvaShipmentStatus;
  cost: number;
  igv: number;
  senderEmail: string;
  senderProfileId: string | null;
  senderDocumentNumber: string | null;
  recipientEmail: string;
  whoPays: OlvaWhoPays;
  deliveryType: OlvaDeliveryType;
  /** Null for shipments created without an order reference. */
  externalRef: OlvaShipmentExternalRefResponseDto | null;
  createdAt: string;
  updatedAt: string;
}

// GET /olva/shipments/:id and POST /olva/shipments/:id/payment-link
export interface OlvaShipmentResponseDto extends OlvaShipmentListItemResponseDto {
  securityPin: string | null;
  payment: OlvaShipmentPaymentResponseDto | null;
}

// POST /olva/shipments -> 201. The label only comes back here (it is never stored).
export interface CreateOlvaShipmentResponseDto extends OlvaShipmentResponseDto {
  label?: OlvaShipmentLabelResponseDto;
}
