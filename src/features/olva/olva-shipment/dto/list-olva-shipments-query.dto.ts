import type { OlvaShipmentStatus } from "../../shared/constants/olva-enums.constants";

// Query string of GET /olva/shipments. page >= 1, limit 1..100, q up to 100 chars.
export interface ListOlvaShipmentsQueryDto {
  page?: number;
  limit?: number;
  status?: OlvaShipmentStatus;
  q?: string;
  // Only the shipments made for this order / guide of the caller (max 100 characters)
  orderId?: string;
  guideId?: string;
}
