"use client";

import { useQuery } from "@tanstack/react-query";
import { olvaShipmentQueries } from "@/features/olva/olva-shipment/queries/olva-shipment.queries";
import { OlvaShipmentCell } from "./OlvaShipmentCell";
import { SEND_TO_OLVA_GUIDE_SHIPMENTS_LIMIT } from "./send-to-olva/constants/send-to-olva.constants";
import { getOlvaShipmentByOrder } from "./utils/get-olva-shipment-by-order";

interface OlvaOrderShipmentCellProps {
  guideId: string;
  orderId: string;
}

/**
 * The Olva shipment of one order of a guide. Every row reads the same list query (one request per
 * guide, shared by key), so the guide does not need a QueryClient of its own to show it.
 */
export function OlvaOrderShipmentCell({ guideId, orderId }: OlvaOrderShipmentCellProps) {
  const { data: shipment } = useQuery({
    ...olvaShipmentQueries.list({ guideId, limit: SEND_TO_OLVA_GUIDE_SHIPMENTS_LIMIT }),
    select: (page) => getOlvaShipmentByOrder(page.items).get(orderId) ?? null,
  });

  return <OlvaShipmentCell shipment={shipment ?? null} />;
}
