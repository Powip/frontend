import type {
  OlvaDeliveryType,
  OlvaQuoteShipmentType,
} from "../../shared/constants/olva-enums.constants";

export interface OlvaQuoteInput {
  originUbigeo: string;
  destinationUbigeo: string;
  deliveryType: OlvaDeliveryType;
  shipmentType: OlvaQuoteShipmentType;
  weightKg: number;
  /** Package size in cm. Olva refuses a parcel (type 2) quote without all three. */
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  partnerRate?: boolean;
}
