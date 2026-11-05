import type {
  OLVA_DELIVERY_TYPES,
  OLVA_WHO_PAYS_OPTIONS,
  OlvaIdentityDocumentType,
  OlvaPaymentMethod,
  OlvaWhoPays,
} from "../../shared/constants/olva-enums.constants";

/** What every shipment has, whatever its delivery type. */
interface OlvaShipmentItemBaseInput {
  recipient: {
    documentNumber: string;
    documentType?: OlvaIdentityDocumentType;
    fullName: string;
    phone: string;
    email?: string;
  };
  origin: {
    headquarterId: string;
    address?: string;
  };
  package: {
    weightKg: number;
    shipmentType?: 2;
    sizeId?: string;
    declaredValue: number;
    insuranceAccepted?: boolean;
    articleId?: number;
    description?: string;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  };
  /** The order (and guide) of the caller this shipment is for. */
  externalRef?: {
    orderId: string;
    guideId?: string;
  };
}

/** Store pickup (`O`, the default): the recipient collects it at an agency. */
export interface OlvaStorePickupInput {
  deliveryType?: typeof OLVA_DELIVERY_TYPES.STORE_PICKUP;
  destination: {
    agencyCode: string;
  };
  whoPays?: OlvaWhoPays;
  paymentMethod?: OlvaPaymentMethod;
  pin?: string;
}

/**
 * Home delivery (`D`): `ubigeoCode` is the 6-digit code from the ubigeo catalog. Olva only
 * registers it paid online, and it has no pickup PIN.
 */
export interface OlvaHomeDeliveryInput {
  deliveryType: typeof OLVA_DELIVERY_TYPES.HOME_DELIVERY;
  destination: {
    ubigeoCode: string;
    address: string;
    reference: string;
  };
  whoPays: typeof OLVA_WHO_PAYS_OPTIONS.ONLINE;
  paymentMethod: OlvaPaymentMethod;
  pin?: never;
}

/** The fields that depend on the delivery type, told apart by `deliveryType`. */
export type OlvaShipmentDeliveryInput = OlvaStorePickupInput | OlvaHomeDeliveryInput;

/**
 * One shipment, as the form produces it. Optional text may be blank; the mapper drops those.
 * Shared by single creation and by every item of a bulk lot.
 */
export type CreateOlvaShipmentItemInput = OlvaShipmentItemBaseInput & OlvaShipmentDeliveryInput;

export type CreateOlvaShipmentInput = CreateOlvaShipmentItemInput & {
  senderProfileId?: string;
  confirm?: boolean;
};

export interface CreateOlvaShipmentVariables {
  input: CreateOlvaShipmentInput;
  /** Same key = same shipment, even if the request is repeated (see `useCreateOlvaShipment`). */
  idempotencyKey: string;
}
