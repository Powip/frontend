import { useQuery } from "@tanstack/react-query";
import { olvaShipmentQueries } from "../queries/olva-shipment.queries";

/**
 * The shipments made for one of the caller's orders (`externalRef.orderId`), to know if an order
 * already has a guide. Idle until there is an order id.
 */
export function useOlvaShipmentByOrder(orderId: string | null | undefined) {
  return useQuery(olvaShipmentQueries.byOrder(orderId));
}
