import type { OlvaShipmentListItemResponseDto } from "./olva-shipment-response.dto";

// GET /olva/shipments -> 200 (note: `data`, not `results`)
export interface ListOlvaShipmentsResponseDto {
  data: OlvaShipmentListItemResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
