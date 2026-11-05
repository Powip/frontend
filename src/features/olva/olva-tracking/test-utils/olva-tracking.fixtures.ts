import type { TrackOlvaShipmentResponseDto } from "../dto/track-olva-shipment-response.dto";
import type {
  OlvaTrackingBatchItemDto,
  TrackOlvaShipmentsBatchResponseDto,
} from "../dto/track-olva-shipments-batch-response.dto";

export function buildTrackOlvaShipmentResponse(
  overrides: Partial<TrackOlvaShipmentResponseDto> = {},
): TrackOlvaShipmentResponseDto {
  return {
    trackingNumber: "123456789012",
    status: "IN_TRANSIT",
    statusDetail: "En ruta a destino",
    origin: { agency: "Agencia Lima", department: "LIMA" },
    destination: { agency: null, department: "AREQUIPA" },
    estimatedDelivery: "2026-10-26",
    deliveredAt: null,
    events: [
      { date: "2026-10-20", status: "REGISTERED", detail: "Registrado", location: "LIMA" },
      { date: "2026-10-21", status: "IN_TRANSIT", detail: null, location: null },
    ],
    ...overrides,
  };
}

export function buildTrackOlvaBatchResponse(): TrackOlvaShipmentsBatchResponseDto {
  const found: OlvaTrackingBatchItemDto = {
    ...buildTrackOlvaShipmentResponse(),
    success: true,
    orderNumber: "123456789012",
    orderCode: null,
  };
  const failed: OlvaTrackingBatchItemDto = {
    success: false,
    orderNumber: "999999",
    orderCode: "26",
    error: "Guía no encontrada",
  };

  return { results: [found, failed] };
}
