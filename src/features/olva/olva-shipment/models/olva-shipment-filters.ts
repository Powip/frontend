import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";

export interface OlvaShipmentFilters {
  page?: number;
  limit?: number;
  status?: OlvaShipmentStatus;
  /** Free text search. */
  q?: string;
  /** Only the shipments made for this order of the caller. */
  orderId?: string;
  guideId?: string;
}
