import type { OlvaShipmentLabelResponseDto } from "../dto/olva-shipment-response.dto";
import type { OlvaShipmentLabel } from "../models/olva-shipment-label";

export function toOlvaShipmentLabel(dto: OlvaShipmentLabelResponseDto): OlvaShipmentLabel {
  return { filename: dto.filename, mimeType: dto.mimeType, pdfBase64: dto.pdfBase64 };
}
