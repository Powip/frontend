import type {
  OlvaDeliveryType,
  OlvaQuoteShipmentType,
} from "../../shared/constants/olva-enums.constants";

// POST /olva/quotes (strict body)
export interface CalculateOlvaQuoteRequestDto {
  /** 6-digit ubigeo codes. */
  origin: string;
  destination: string;
  deliveryType: OlvaDeliveryType;
  shipmentType: OlvaQuoteShipmentType;
  weightKg: number;
  /** Package size in cm: required with `shipmentType` 2, ignored with 1. */
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  partnerRate: boolean;
}
