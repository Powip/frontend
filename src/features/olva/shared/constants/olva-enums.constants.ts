import type { ValueOf } from "../types/value-of.type";

// Mirrors ms-integrations: src/olva/domain/**/*.enums.ts
// Plain `as const` objects (not TS enums): they erase to string literals, work with z.enum()
// and keep the wire values readable in network tools.

export const OLVA_SHIPMENT_STATUSES = {
  DRAFT: "DRAFT",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",
  REGISTERED: "REGISTERED",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  DELIVERED: "DELIVERED",
  RETURNED: "RETURNED",
  REJECTED: "REJECTED",
  UNKNOWN: "UNKNOWN",
} as const;

export type OlvaShipmentStatus = ValueOf<typeof OLVA_SHIPMENT_STATUSES>;

/** Who pays the shipment. */
export const OLVA_WHO_PAYS_OPTIONS = {
  ONLINE: "ONLINE",
  DESTINATION: "DESTINATION",
  STORE: "STORE",
} as const;

export type OlvaWhoPays = ValueOf<typeof OLVA_WHO_PAYS_OPTIONS>;

/** `O` = the recipient picks it up at an Olva store, `D` = home delivery. */
export const OLVA_DELIVERY_TYPES = {
  STORE_PICKUP: "O",
  HOME_DELIVERY: "D",
} as const;

export type OlvaDeliveryType = ValueOf<typeof OLVA_DELIVERY_TYPES>;

export const OLVA_PAYMENT_METHODS = {
  PAGOEFECTIVO: "pagoefectivo",
  NIUBIZ: "niubiz",
} as const;

export type OlvaPaymentMethod = ValueOf<typeof OLVA_PAYMENT_METHODS>;

export const OLVA_IDENTITY_DOCUMENT_TYPES = {
  DNI: "dni",
  RUC: "ruc",
} as const;

export type OlvaIdentityDocumentType = ValueOf<typeof OLVA_IDENTITY_DOCUMENT_TYPES>;

export const OLVA_CURRENCIES = {
  PEN: "PEN",
  USD: "USD",
} as const;

export type OlvaCurrency = ValueOf<typeof OLVA_CURRENCIES>;

/** The tariff differs between a document and a parcel. */
export const OLVA_QUOTE_SHIPMENT_TYPES = {
  DOCUMENT: 1,
  PACKAGE: 2,
} as const;

export type OlvaQuoteShipmentType = ValueOf<typeof OLVA_QUOTE_SHIPMENT_TYPES>;

/** Which side of a shipment a person lookup is for: Olva answers in that side's format. */
export const OLVA_PERSON_ROLES = {
  SENDER: "sender",
  RECIPIENT: "recipient",
} as const;

export type OlvaPersonRole = ValueOf<typeof OLVA_PERSON_ROLES>;

/** Days of an agency's weekly schedule. */
export const OLVA_AGENCY_WEEKDAYS = {
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
} as const;

export type OlvaAgencyWeekday = ValueOf<typeof OLVA_AGENCY_WEEKDAYS>;
