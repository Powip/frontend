import type {
  OLVA_DELIVERY_TYPES,
  OLVA_WHO_PAYS_OPTIONS,
  OlvaIdentityDocumentType,
  OlvaPaymentMethod,
  OlvaWhoPays,
} from "../../shared/constants/olva-enums.constants";

// What describes ONE shipment, whether it is created alone (POST /olva/shipments) or as an item of
// a lot (POST /olva/shipments/bulk). The sender is not here: it comes from the sender profile.
export interface OlvaShipmentRecipientRequestDto {
  documentNumber: string;
  documentType?: OlvaIdentityDocumentType;
  fullName: string;
  phone: string;
  email?: string;
}

export interface OlvaShipmentOriginRequestDto {
  headquarterId: string;
  address?: string;
}

/** Store pickup (deliveryType O, the default): the recipient collects it at an agency. */
export interface OlvaStorePickupDestinationRequestDto {
  agencyCode: string;
}

/** Home delivery (deliveryType D): a place from the ubigeo catalog plus where to knock. */
export interface OlvaHomeDeliveryDestinationRequestDto {
  /** 6-digit ubigeo code (e.g. "150101"), from GET /olva/catalog/ubigeos. */
  ubigeoCode: string;
  address: string;
  /** At least 3 characters. */
  reference: string;
}

export interface OlvaShipmentPackageRequestDto {
  weightKg: number;
  /** Olva only registers packages: 2, which is also the default. */
  shipmentType?: 2;
  sizeId?: string;
  /** Required, at least 0.0101. At most 1500 when the destination pays. */
  declaredValue: number;
  insuranceAccepted?: boolean;
  articleId?: number;
  description?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

/** The caller's own order (and guide) a shipment is for; stored and echoed back. */
export interface OlvaShipmentExternalRefRequestDto {
  /** Prevents shipping the same order twice while its shipment is active. */
  orderId: string;
  guideId?: string;
}

/** What every shipment has, whatever its delivery type. */
interface OlvaShipmentItemRequestBaseDto {
  recipient: OlvaShipmentRecipientRequestDto;
  origin: OlvaShipmentOriginRequestDto;
  package: OlvaShipmentPackageRequestDto;
  externalRef?: OlvaShipmentExternalRefRequestDto;
}

/** Store pickup: an agency. The backend refuses a `ubigeoCode` here. */
export interface OlvaStorePickupItemRequestDto extends OlvaShipmentItemRequestBaseDto {
  deliveryType?: typeof OLVA_DELIVERY_TYPES.STORE_PICKUP;
  destination: OlvaStorePickupDestinationRequestDto;
  whoPays?: OlvaWhoPays;
  /** Required with whoPays ONLINE and forbidden otherwise. */
  paymentMethod?: OlvaPaymentMethod;
  /** Exactly 4 digits; Olva generates one when omitted. */
  pin?: string;
}

/** Home delivery: Olva only registers it paid online, and it has no pickup PIN. */
export interface OlvaHomeDeliveryItemRequestDto extends OlvaShipmentItemRequestBaseDto {
  deliveryType: typeof OLVA_DELIVERY_TYPES.HOME_DELIVERY;
  destination: OlvaHomeDeliveryDestinationRequestDto;
  whoPays: typeof OLVA_WHO_PAYS_OPTIONS.ONLINE;
  paymentMethod: OlvaPaymentMethod;
  pin?: never;
}

/** Told apart by `deliveryType`, so an agency can never travel with a home delivery. */
export type OlvaShipmentItemRequestDto =
  | OlvaStorePickupItemRequestDto
  | OlvaHomeDeliveryItemRequestDto;
