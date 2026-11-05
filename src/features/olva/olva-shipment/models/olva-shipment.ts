import type {
  OLVA_PAYMENT_METHODS,
  OlvaCurrency,
  OlvaDeliveryType,
  OlvaShipmentStatus,
  OlvaWhoPays,
} from "../../shared/constants/olva-enums.constants";

interface OlvaShipmentPaymentBase {
  amount?: number;
  currency?: OlvaCurrency;
  expiresAt?: Date;
  paid?: boolean;
  expired?: boolean;
  gatewayStatus?: string;
  checkedAt?: Date;
  /** The last known state is shown because Olva could not be asked. */
  stale?: boolean;
}

/** Paid outside our front: with a link, or with a code at a PagoEfectivo agent. */
export interface OlvaPagoEfectivoPayment extends OlvaShipmentPaymentBase {
  method: typeof OLVA_PAYMENT_METHODS.PAGOEFECTIVO;
  /** Link where the sender pays online. */
  url?: string;
  /** Code to pay at a PagoEfectivo agent. */
  cipCode?: string;
  hoursAvailable?: number;
  /** QR image of the payment. */
  qrImage?: string;
}

/**
 * Paid by card in a checkout form: load `checkoutScriptUrl` and open it with `sessionKey` and
 * `merchantId`. Absent once the shipment is paid or the session expired. A short-lived
 * credential: do not store or log it.
 */
export interface OlvaNiubizPayment extends OlvaShipmentPaymentBase {
  method: typeof OLVA_PAYMENT_METHODS.NIUBIZ;
  sessionKey?: string;
  merchantId?: string;
  checkoutScriptUrl?: string;
}

/** A method Olva adds later: only what every payment has. */
export interface OlvaOtherPayment extends OlvaShipmentPaymentBase {
  method: string;
}

export type OlvaShipmentPayment = OlvaPagoEfectivoPayment | OlvaNiubizPayment | OlvaOtherPayment;

/** The caller's own order (and guide) a shipment was made for. */
export interface OlvaShipmentExternalRef {
  orderId: string;
  guideId: string | null;
}

/** A row of the shipments list (no payment, no pickup PIN). */
export interface OlvaShipmentSummary {
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
  externalRef: OlvaShipmentExternalRef | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OlvaShipment extends OlvaShipmentSummary {
  /** Code the recipient shows to pick the shipment up. */
  securityPin: string | null;
  payment: OlvaShipmentPayment | null;
}
