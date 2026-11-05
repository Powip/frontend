import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";

export interface OlvaTrackingPlaceResponseDto {
  agency: string | null;
  department: string | null;
}

export interface OlvaTrackingEventResponseDto {
  /** YYYY-MM-DD, no time or zone. */
  date: string;
  status: OlvaShipmentStatus;
  detail: string | null;
  location: string | null;
}

// POST /olva/track -> 200. Also the tracking fields of each successful batch item.
export interface TrackOlvaShipmentResponseDto {
  trackingNumber: string;
  status: OlvaShipmentStatus;
  statusDetail: string | null;
  origin: OlvaTrackingPlaceResponseDto | null;
  destination: OlvaTrackingPlaceResponseDto | null;
  /** YYYY-MM-DD; null while Olva has no estimate. */
  estimatedDelivery: string | null;
  /** YYYY-MM-DD; null until delivered. */
  deliveredAt: string | null;
  events: OlvaTrackingEventResponseDto[];
}
