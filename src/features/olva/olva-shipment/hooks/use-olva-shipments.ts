import { useQuery } from "@tanstack/react-query";
import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";
import { olvaShipmentQueries } from "../queries/olva-shipment.queries";

export function useOlvaShipments(filters: OlvaShipmentFilters = {}) {
  return useQuery(olvaShipmentQueries.list(filters));
}
