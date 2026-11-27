import type { TrackOlvaShipmentResponseDto } from "../dto/track-olva-shipment-response.dto";
import type { OlvaTracking } from "../models/olva-tracking";

export function toOlvaTracking(dto: TrackOlvaShipmentResponseDto): OlvaTracking {
  return {
    trackingNumber: dto.trackingNumber,
    status: dto.status,
    statusDetail: dto.statusDetail,
    origin: dto.origin ? { ...dto.origin } : null,
    destination: dto.destination ? { ...dto.destination } : null,
    estimatedDelivery: dto.estimatedDelivery,
    deliveredAt: dto.deliveredAt,
    events: dto.events.map((event) => ({ ...event })),
  };
}
