import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";

export interface OlvaTrackingPlace {
  agency: string | null;
  department: string | null;
}

export interface OlvaTrackingEvent {
  /**
   * "YYYY-MM-DD". Kept as text on purpose: it has no time or zone, and a `Date` would shift
   * it a day in some time zones. Use `formatOlvaTrackingDate` to show it.
   */
  date: string;
  status: OlvaShipmentStatus;
  detail: string | null;
  location: string | null;
}

export interface OlvaTracking {
  trackingNumber: string;
  status: OlvaShipmentStatus;
  statusDetail: string | null;
  origin: OlvaTrackingPlace | null;
  destination: OlvaTrackingPlace | null;
  /** "YYYY-MM-DD", null while Olva has no estimate. */
  estimatedDelivery: string | null;
  /** "YYYY-MM-DD", null until delivered. */
  deliveredAt: string | null;
  /** Oldest first, as Olva reports them. */
  events: OlvaTrackingEvent[];
}
