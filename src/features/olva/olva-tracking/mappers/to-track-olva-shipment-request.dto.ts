import { omitEmptyOlvaValues } from "../../shared/utils/omit-empty-olva-values";
import type { TrackOlvaShipmentRequestDto } from "../dto/track-olva-shipment-request.dto";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";

/** Trims both values and drops a blank `orderCode` (the backend would reject it as invalid). */
export function toTrackOlvaShipmentRequestDto(
  lookup: OlvaTrackingLookup,
): TrackOlvaShipmentRequestDto {
  return omitEmptyOlvaValues({
    orderNumber: lookup.orderNumber,
    orderCode: lookup.orderCode,
  }) as TrackOlvaShipmentRequestDto;
}
