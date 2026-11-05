import type { TrackOlvaShipmentsBatchRequestDto } from "../dto/track-olva-shipments-batch-request.dto";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";
import { toTrackOlvaShipmentRequestDto } from "./to-track-olva-shipment-request.dto";

export function toTrackOlvaShipmentsBatchRequestDto(
  lookups: readonly OlvaTrackingLookup[],
): TrackOlvaShipmentsBatchRequestDto {
  return { shipments: lookups.map(toTrackOlvaShipmentRequestDto) };
}
