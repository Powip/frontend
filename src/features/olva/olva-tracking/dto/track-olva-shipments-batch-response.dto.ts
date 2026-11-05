import type { TrackOlvaShipmentResponseDto } from "./track-olva-shipment-response.dto";

// Echo of what was asked, so an item can be matched without relying on order
interface OlvaTrackingBatchItemIdentityDto {
  orderNumber: string;
  orderCode: string | null;
}

export interface OlvaTrackingBatchSuccessItemDto
  extends TrackOlvaShipmentResponseDto,
    OlvaTrackingBatchItemIdentityDto {
  success: true;
}

export interface OlvaTrackingBatchFailureItemDto extends OlvaTrackingBatchItemIdentityDto {
  success: false;
  /** Why this one guide could not be tracked (for example, it does not exist). */
  error: string;
}

export type OlvaTrackingBatchItemDto =
  | OlvaTrackingBatchSuccessItemDto
  | OlvaTrackingBatchFailureItemDto;

// POST /olva/track/batch -> 200. One item per requested guide, in request order. One failing
// guide does NOT fail the request: it comes back as `success: false`.
export interface TrackOlvaShipmentsBatchResponseDto {
  results: OlvaTrackingBatchItemDto[];
}
