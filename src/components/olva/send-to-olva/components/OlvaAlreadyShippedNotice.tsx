"use client";

import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { OlvaShipmentSummary } from "@/features/olva/olva-shipment/models/olva-shipment";

interface OlvaAlreadyShippedNoticeProps {
  orders: readonly OrderDetail[];
  shipments: ReadonlyMap<string, OlvaShipmentSummary>;
}

/** The orders of the guide that already have an active Olva shipment, left out of the form. */
export function OlvaAlreadyShippedNotice({ orders, shipments }: OlvaAlreadyShippedNoticeProps) {
  const shipped = orders.filter((order) => shipments.has(order.id));

  if (shipped.length === 0) return null;

  return (
    <Alert>
      <AlertTitle>
        {shipped.length === 1
          ? "1 pedido ya tiene envío en Olva"
          : `${shipped.length} pedidos ya tienen envío en Olva`}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc pl-4">
          {shipped.map((order) => {
            const tracking = shipments.get(order.id)?.trackingNumber;

            return (
              <li key={order.id}>
                {order.orderNumber}
                {tracking ? ` — seguimiento ${tracking}` : ""}
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
