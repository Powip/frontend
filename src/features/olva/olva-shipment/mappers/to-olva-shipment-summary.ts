import type { OlvaShipmentListItemResponseDto } from "../dto/olva-shipment-response.dto";
import type { OlvaShipmentSummary } from "../models/olva-shipment";

export function toOlvaShipmentSummary(dto: OlvaShipmentListItemResponseDto): OlvaShipmentSummary {
  return {
    id: dto.id,
    internalId: dto.internalId,
    trackingNumber: dto.trackingNumber,
    registrationNumber: dto.registrationNumber,
    status: dto.status,
    cost: dto.cost,
    igv: dto.igv,
    senderEmail: dto.senderEmail,
    senderProfileId: dto.senderProfileId,
    senderDocumentNumber: dto.senderDocumentNumber,
    recipientEmail: dto.recipientEmail,
    whoPays: dto.whoPays,
    deliveryType: dto.deliveryType,
    externalRef: dto.externalRef ? { ...dto.externalRef } : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
