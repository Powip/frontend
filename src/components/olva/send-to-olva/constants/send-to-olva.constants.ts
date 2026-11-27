import { OLVA_DELIVERY_TYPES } from "@/features/olva/shared/constants/olva-enums.constants";

/** Weight preloaded in every order until the user weighs the package. */
export const SEND_TO_OLVA_DEFAULT_WEIGHT_KG = 1;

/** The package content is built from the order items; long lists are cut to this. */
export const SEND_TO_OLVA_DESCRIPTION_MAX_LENGTH = 150;

export const SEND_TO_OLVA_DEFAULT_DELIVERY_TYPE = OLVA_DELIVERY_TYPES.STORE_PICKUP;

/**
 * Master switch for online payment (FEAT-35: on, with PagoEfectivo). When false the ONLINE
 * modality is not offered and, since home delivery can only be paid online, only store pickup
 * is available. Which online methods work is decided by `OLVA_UNAVAILABLE_PAYMENT_METHODS`.
 */
export const SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE = true;

/** Looks at the guide's shipments to know which orders already have an active one. */
export const SEND_TO_OLVA_GUIDE_SHIPMENTS_LIMIT = 100;

export const SEND_TO_OLVA_VIEWS = {
  EDIT: "edit",
  RESULTS: "results",
} as const;

export type SendToOlvaView = (typeof SEND_TO_OLVA_VIEWS)[keyof typeof SEND_TO_OLVA_VIEWS];

export const SEND_TO_OLVA_DELIVERY_TYPE_LABELS = {
  [OLVA_DELIVERY_TYPES.STORE_PICKUP]: "Recojo en agencia",
  [OLVA_DELIVERY_TYPES.HOME_DELIVERY]: "Entrega a domicilio",
} as const;

/** Public tracking page of the storefront: `${NEXT_PUBLIC_LANDING_URL}/rastreo/<orderNumber>`. */
export const SEND_TO_OLVA_TRACKING_PATH = "/rastreo";
