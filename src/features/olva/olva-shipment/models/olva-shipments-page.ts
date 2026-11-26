import type { OlvaShipmentSummary } from "./olva-shipment";

export interface OlvaShipmentsPage {
  items: OlvaShipmentSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
