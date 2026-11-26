import type { CalculateOlvaQuoteRequestDto } from "../dto/calculate-olva-quote-request.dto";
import type { OlvaQuoteInput } from "../models/olva-quote-input";

export function toCalculateOlvaQuoteRequestDto(
  input: OlvaQuoteInput,
): CalculateOlvaQuoteRequestDto {
  return {
    origin: input.originUbigeo,
    destination: input.destinationUbigeo,
    deliveryType: input.deliveryType,
    shipmentType: input.shipmentType,
    weightKg: input.weightKg,
    ...(input.lengthCm !== undefined ? { lengthCm: input.lengthCm } : {}),
    ...(input.widthCm !== undefined ? { widthCm: input.widthCm } : {}),
    ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
    partnerRate: input.partnerRate ?? false,
  };
}
