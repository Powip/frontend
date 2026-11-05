import type { TrackOlvaShipmentRequestDto } from "./track-olva-shipment-request.dto";

// POST /olva/track/batch (1 to 50 guides)
export interface TrackOlvaShipmentsBatchRequestDto {
  shipments: TrackOlvaShipmentRequestDto[];
}
