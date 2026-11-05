import { trackOlvaShipmentApi, trackOlvaShipmentsBatchApi } from "../api/olva-tracking.api";
import { toOlvaTracking } from "../mappers/to-olva-tracking";
import { toOlvaTrackingBatchItem } from "../mappers/to-olva-tracking-batch-item";
import { toTrackOlvaShipmentRequestDto } from "../mappers/to-track-olva-shipment-request.dto";
import { toTrackOlvaShipmentsBatchRequestDto } from "../mappers/to-track-olva-shipments-batch-request.dto";
import type { OlvaTracking } from "../models/olva-tracking";
import type { OlvaTrackingBatchItem } from "../models/olva-tracking-batch-item";
import type { OlvaTrackingLookup } from "../models/olva-tracking-lookup";

export async function trackOlvaShipment(lookup: OlvaTrackingLookup): Promise<OlvaTracking> {
  return toOlvaTracking(await trackOlvaShipmentApi(toTrackOlvaShipmentRequestDto(lookup)));
}

export async function trackOlvaShipmentsBatch(
  lookups: readonly OlvaTrackingLookup[],
): Promise<OlvaTrackingBatchItem[]> {
  const { results } = await trackOlvaShipmentsBatchApi(
    toTrackOlvaShipmentsBatchRequestDto(lookups),
  );

  return results.map(toOlvaTrackingBatchItem);
}
