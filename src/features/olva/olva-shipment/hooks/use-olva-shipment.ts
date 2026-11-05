import { useQuery } from "@tanstack/react-query";
import { olvaShipmentQueries } from "../queries/olva-shipment.queries";

/** Idle until there is an id. Re-reads itself while the shipment awaits payment. */
export function useOlvaShipment(id: string | null | undefined) {
  return useQuery(olvaShipmentQueries.detail(id));
}
