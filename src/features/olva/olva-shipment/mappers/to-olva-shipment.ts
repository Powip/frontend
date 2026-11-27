import type { OlvaShipmentResponseDto } from "../dto/olva-shipment-response.dto";
import type { OlvaShipment } from "../models/olva-shipment";
import { toOlvaShipmentPayment } from "./to-olva-shipment-payment";
import { toOlvaShipmentSummary } from "./to-olva-shipment-summary";

export function toOlvaShipment(dto: OlvaShipmentResponseDto): OlvaShipment {
  return {
    ...toOlvaShipmentSummary(dto),
    securityPin: dto.securityPin,
    payment: dto.payment ? toOlvaShipmentPayment(dto.payment) : null,
  };
}
