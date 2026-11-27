import type { OlvaCurrency, OlvaDeliveryType } from "../../shared/constants/olva-enums.constants";

export interface OlvaQuote {
  amount: number;
  currency: OlvaCurrency;
  /** Weight above the tariff's included weight, billed extra. */
  excessWeightKg: number;
  deliveryType: OlvaDeliveryType;
}
