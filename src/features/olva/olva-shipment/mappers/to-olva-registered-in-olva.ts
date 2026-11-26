import type { OlvaBulkRegisteredInOlvaResponseDto } from "../dto/bulk-create-olva-shipments-response.dto";
import type { OlvaRegisteredInOlva } from "../models/olva-bulk-shipment-result";
import { toOlvaShipmentPayment } from "./to-olva-shipment-payment";

export function toOlvaRegisteredInOlva(
  dto: OlvaBulkRegisteredInOlvaResponseDto,
): OlvaRegisteredInOlva {
  return {
    id: dto.id,
    registrationNumber: dto.registrationNumber,
    trackingNumber: dto.trackingNumber,
    status: dto.status,
    cost: dto.cost,
    igv: dto.igv,
    payment: dto.payment ? toOlvaShipmentPayment(dto.payment) : null,
  };
}
