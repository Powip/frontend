"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatOlvaAmount } from "@/features/olva/olva-quote/utils/format-olva-amount";
import { OLVA_SHIPMENT_ERROR_CODES } from "@/features/olva/olva-shipment/constants/olva-shipment-error-codes.constants";
import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import { olvaShipmentQueries } from "@/features/olva/olva-shipment/queries/olva-shipment.queries";
import { OLVA_SHIPMENT_ERROR_MESSAGES } from "@/features/olva/olva-shipment/utils/olva-shipment-error.util";
import { OLVA_CURRENCIES } from "@/features/olva/shared/constants/olva-enums.constants";
import { OlvaShipmentCell } from "../../OlvaShipmentCell";

interface OlvaResultRowProps {
  result: OlvaBulkShipmentResult;
  order: OrderDetail | undefined;
  onShareWhatsApp: (order: OrderDetail, trackingNumber: string | null) => void;
}

const formatCost = (cost: number) => formatOlvaAmount(cost, OLVA_CURRENCIES.PEN);

/**
 * What happened to one order of the lot, and what can be done next with it. The shipment itself
 * (status, label, payment, retry) is `OlvaShipmentCell`, the same one the guide shows.
 */
export function OlvaResultRow({ result, order, onShareWhatsApp }: OlvaResultRowProps) {
  // What the cell learned since (paid, new tracking number), read from the cache it fills
  const { data: live } = useQuery({
    ...olvaShipmentQueries.detail(result.status === "created" ? result.shipment.id : null),
    enabled: false,
  });
  const title = order ? `Pedido ${order.orderNumber}` : `Pedido ${result.itemKey}`;

  if (result.status === "failed") {
    const message = OLVA_SHIPMENT_ERROR_MESSAGES[result.error.code] ?? result.error.message;
    const taken = result.error.code === OLVA_SHIPMENT_ERROR_CODES.ALREADY_EXISTS;

    return (
      <li className="grid gap-2 rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{title}</span>
          <Badge variant="destructive">{taken ? "Ya enviado" : "Falló"}</Badge>
        </div>
        <p className="text-sm">{message}</p>
        {taken && result.existingShipment?.trackingNumber ? (
          <p className="text-muted-foreground text-xs">
            Seguimiento: {result.existingShipment.trackingNumber}
          </p>
        ) : null}
      </li>
    );
  }

  // OLVA_OUTCOME_UNKNOWN: the reserved shipment (SUBMITTING), retried from the cell, never resent
  if (result.status === "unknown") {
    return (
      <li className="grid gap-2 rounded-md border p-3">
        <span className="font-medium">{title}</span>
        <OlvaShipmentCell shipment={result.shipment} />
      </li>
    );
  }

  const { shipment } = result;

  return (
    <li className="grid gap-2 rounded-md border p-3">
      <span className="font-medium">{title}</span>
      <OlvaShipmentCell shipment={shipment} label={result.label} />

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs">Costo</dt>
          <dd>{formatCost(shipment.cost)}</dd>
        </div>
        {shipment.securityPin ? (
          <div>
            <dt className="text-muted-foreground text-xs">PIN de recojo</dt>
            <dd>{shipment.securityPin}</dd>
          </div>
        ) : null}
      </dl>

      {order ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Enviar seguimiento por WhatsApp"
            onClick={() => onShareWhatsApp(order, (live ?? shipment).trackingNumber)}
          >
            <WhatsAppIcon className="mr-1 size-4" />
            WhatsApp
          </Button>
        </div>
      ) : null}
    </li>
  );
}
