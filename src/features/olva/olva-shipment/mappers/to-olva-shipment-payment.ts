import type { OlvaShipmentPaymentResponseDto } from "../dto/olva-shipment-response.dto";
import type { OlvaShipmentPayment } from "../models/olva-shipment";

export function toOlvaShipmentPayment(dto: OlvaShipmentPaymentResponseDto): OlvaShipmentPayment {
  const { expiresAt, checkedAt, ...rest } = dto;

  return {
    ...rest,
    ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
    ...(checkedAt ? { checkedAt: new Date(checkedAt) } : {}),
  };
}
