import { useQuery } from "@tanstack/react-query";
import { olvaShipmentQueries } from "@/features/olva/olva-shipment/queries/olva-shipment.queries";
import { SEND_TO_OLVA_GUIDE_SHIPMENTS_LIMIT } from "../constants/send-to-olva.constants";
import { getOlvaActiveShipmentsByOrder } from "../utils/get-olva-active-shipments-by-order";

/**
 * The Olva shipments already made for a guide, as order id -> shipment. Orders in it must not be
 * sent again. Idle without a guide id (`isSettled` is then true: there is nothing to wait for).
 */
export function useOlvaActiveShipmentsByOrder(guideId: string | undefined) {
  const query = useQuery({
    ...olvaShipmentQueries.list({ guideId, limit: SEND_TO_OLVA_GUIDE_SHIPMENTS_LIMIT }),
    enabled: Boolean(guideId),
    select: (page) => getOlvaActiveShipmentsByOrder(page.items),
  });

  return {
    activeByOrder: query.data,
    // A failed lookup does not block sending: the backend still refuses duplicate orders
    isSettled: !guideId || query.isSuccess || query.isError,
    isError: query.isError,
  };
}
