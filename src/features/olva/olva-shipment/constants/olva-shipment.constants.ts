import {
  OLVA_SHIPMENT_STATUSES,
  type OlvaShipmentStatus,
} from "../../shared/constants/olva-enums.constants";

export const OLVA_SHIPMENTS_DEFAULT_PAGE = 1;
export const OLVA_SHIPMENTS_DEFAULT_PAGE_SIZE = 20;
export const OLVA_SHIPMENTS_MAX_PAGE_SIZE = 100;
export const OLVA_SHIPMENTS_SEARCH_MAX_LENGTH = 100;
/** One order can have several shipments over time (released ones), so look at a few. */
export const OLVA_SHIPMENTS_BY_ORDER_LIMIT = 5;

export const OLVA_SHIPMENT_PIN_LENGTH = 4;

/** A ubigeo code (INEI) has 6 digits, e.g. "150101". Olva's own id for it is another thing. */
export const OLVA_UBIGEO_CODE_LENGTH = 6;

/** Olva rejects a home delivery whose reference has fewer than 3 characters. */
export const OLVA_HOME_DELIVERY_MIN_REFERENCE_LENGTH = 3;

const SECOND_MS = 1000;

export const OLVA_SHIPMENT_LIST_STALE_TIME_MS = 30 * SECOND_MS;
export const OLVA_SHIPMENT_DETAIL_STALE_TIME_MS = 10 * SECOND_MS;
/** While a shipment awaits payment, its detail is re-read to notice the payment. */
export const OLVA_SHIPMENT_PAYMENT_POLL_INTERVAL_MS = 15 * SECOND_MS;
/** The label is a heavy personal-data PDF (served `no-store`): keep it only briefly. */
export const OLVA_SHIPMENT_LABEL_STALE_TIME_MS = 5 * 60 * SECOND_MS;
export const OLVA_SHIPMENT_LABEL_GC_TIME_MS = 5 * 60 * SECOND_MS;

export const OLVA_SHIPMENT_STATUS_LABELS: Record<OlvaShipmentStatus, string> = {
  [OLVA_SHIPMENT_STATUSES.SUBMITTING]: "Registrando",
  [OLVA_SHIPMENT_STATUSES.FAILED]: "Falló",
  [OLVA_SHIPMENT_STATUSES.DISCARDED]: "Descartado",
  [OLVA_SHIPMENT_STATUSES.DRAFT]: "Borrador",
  [OLVA_SHIPMENT_STATUSES.PENDING_PAYMENT]: "Pago pendiente",
  [OLVA_SHIPMENT_STATUSES.PAYMENT_EXPIRED]: "Pago vencido",
  [OLVA_SHIPMENT_STATUSES.REGISTERED]: "Registrado",
  [OLVA_SHIPMENT_STATUSES.IN_TRANSIT]: "En tránsito",
  [OLVA_SHIPMENT_STATUSES.OUT_FOR_DELIVERY]: "En reparto",
  [OLVA_SHIPMENT_STATUSES.READY_FOR_PICKUP]: "Listo para recoger",
  [OLVA_SHIPMENT_STATUSES.DELIVERED]: "Entregado",
  [OLVA_SHIPMENT_STATUSES.RETURNED]: "Devuelto",
  [OLVA_SHIPMENT_STATUSES.REJECTED]: "Rechazado",
  [OLVA_SHIPMENT_STATUSES.INCIDENT]: "Incidencia",
  [OLVA_SHIPMENT_STATUSES.UNKNOWN]: "Desconocido",
};

/** Statuses from which the backend accepts POST /olva/shipments/:id/payment-link. */
export const OLVA_PAYMENT_LINK_REGENERABLE_STATUSES: readonly OlvaShipmentStatus[] = [
  OLVA_SHIPMENT_STATUSES.PENDING_PAYMENT,
  OLVA_SHIPMENT_STATUSES.PAYMENT_EXPIRED,
];

/** Statuses after which a shipment will not change anymore. */
export const OLVA_FINAL_SHIPMENT_STATUSES: readonly OlvaShipmentStatus[] = [
  OLVA_SHIPMENT_STATUSES.DELIVERED,
  OLVA_SHIPMENT_STATUSES.RETURNED,
  OLVA_SHIPMENT_STATUSES.REJECTED,
  OLVA_SHIPMENT_STATUSES.FAILED,
  OLVA_SHIPMENT_STATUSES.DISCARDED,
];

/** Max length of the caller's own references (`externalRef.orderId` / `guideId`). */
export const OLVA_EXTERNAL_REF_MAX_LENGTH = 100;

/** Olva registers packages only (type 2); the size picks envelope or box. */
export const OLVA_PACKAGE_SHIPMENT_TYPE = 2;

/** Olva rejects a declared value of 0 or less. */
export const OLVA_MIN_DECLARED_VALUE = 0.0101;

/** Olva caps the declared value when the destination pays. */
export const OLVA_MAX_DECLARED_VALUE_WHEN_DESTINATION_PAYS = 1500;

/**
 * Statuses of a shipment that no longer holds its order, so the order can be shipped again:
 * DRAFT is only a quote (no guide), REJECTED never got one, RETURNED came back to the sender,
 * FAILED was refused by Olva and DISCARDED was given up by the store (payment expired).
 */
export const OLVA_STATUSES_THAT_RELEASE_ORDER: readonly OlvaShipmentStatus[] = [
  OLVA_SHIPMENT_STATUSES.DRAFT,
  OLVA_SHIPMENT_STATUSES.FAILED,
  OLVA_SHIPMENT_STATUSES.DISCARDED,
  OLVA_SHIPMENT_STATUSES.REJECTED,
  OLVA_SHIPMENT_STATUSES.RETURNED,
];

/** Olva's own cap for POST /olva/shipments/bulk. */
export const OLVA_BULK_SHIPMENTS_MAX_SIZE = 25;
export const OLVA_BULK_ITEM_KEY_MAX_LENGTH = 100;

/** What happened to each shipment of a lot. */
export const OLVA_BULK_ITEM_STATUSES = {
  /** Registered at Olva and stored here. */
  CREATED: "created",
  /**
   * Olva did not confirm the registration (timeout, 5xx): it may exist at Olva. `shipment` is the
   * reserved row (SUBMITTING), which the backend keeps verifying with the same key. Do NOT send
   * the item again: use «Reintentar» on that shipment (POST /olva/shipments/:id/retry).
   */
  UNKNOWN: "unknown",
  /** Nothing was registered. `error` says why; it is safe to fix and resend. */
  FAILED: "failed",
} as const;
