import type { OlvaCurrency, OlvaDeliveryType } from "../../shared/constants/olva-enums.constants";

// POST /olva/quotes -> 200 (read-only: nothing is created)
export interface OlvaQuoteResponseDto {
  amount: number;
  currency: OlvaCurrency;
  excessWeightKg: number;
  deliveryType: OlvaDeliveryType;
}
