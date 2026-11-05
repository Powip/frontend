import type { CreateOlvaShipmentResponseDto } from "../dto/olva-shipment-response.dto";
import type { OlvaCreatedShipment } from "../models/olva-created-shipment";
import { toOlvaShipment } from "./to-olva-shipment";
import { toOlvaShipmentLabel } from "./to-olva-shipment-label";

export function toOlvaCreatedShipment(dto: CreateOlvaShipmentResponseDto): OlvaCreatedShipment {
  const { label, ...shipment } = dto;

  return {
    ...toOlvaShipment(shipment),
    ...(label ? { label: toOlvaShipmentLabel(label) } : {}),
  };
}
