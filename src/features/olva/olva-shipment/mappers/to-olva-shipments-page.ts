import type { ListOlvaShipmentsResponseDto } from "../dto/list-olva-shipments-response.dto";
import type { OlvaShipmentsPage } from "../models/olva-shipments-page";
import { toOlvaShipmentSummary } from "./to-olva-shipment-summary";

export function toOlvaShipmentsPage({
  data,
  meta,
}: ListOlvaShipmentsResponseDto): OlvaShipmentsPage {
  return {
    items: data.map(toOlvaShipmentSummary),
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages,
  };
}
