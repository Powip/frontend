import { useQuery } from "@tanstack/react-query";
import { olvaShipmentQueries } from "../queries/olva-shipment.queries";

/**
 * Pass the id only when the user asks for the label (e.g. on click): it is a heavy PDF with
 * personal data, so it must not be fetched while a list renders.
 */
export function useOlvaShipmentLabel(id: string | null | undefined) {
  return useQuery(olvaShipmentQueries.label(id));
}
