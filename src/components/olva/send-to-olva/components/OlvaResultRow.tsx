"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatOlvaAmount } from "@/features/olva/olva-quote/utils/format-olva-amount";
import { OLVA_SHIPMENT_ERROR_CODES } from "@/features/olva/olva-shipment/constants/olva-shipment-error-codes.constants";
import { useOlvaShipment } from "@/features/olva/olva-shipment/hooks/use-olva-shipment";
import { useRegenerateOlvaShipmentPaymentLink } from "@/features/olva/olva-shipment/hooks/use-regenerate-olva-shipment-payment-link";
import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import type { OlvaShipmentLabel } from "@/features/olva/olva-shipment/models/olva-shipment-label";
import { getOlvaShipmentLabel } from "@/features/olva/olva-shipment/services/olva-shipment.service";
import { canRegenerateOlvaPaymentLink } from "@/features/olva/olva-shipment/utils/can-regenerate-olva-payment-link";
import { getOlvaShipmentStatusLabel } from "@/features/olva/olva-shipment/utils/get-olva-shipment-status-label";
import {
  getOlvaShipmentErrorMessage,
  OLVA_SHIPMENT_ERROR_MESSAGES,
} from "@/features/olva/olva-shipment/utils/olva-shipment-error.util";
import {
  OLVA_CURRENCIES,
  OLVA_SHIPMENT_STATUSES,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { isOlvaNiubizPayment, isOlvaPagoEfectivoPayment } from "../utils/olva-payment-guards";
import { openOlvaLabel } from "../utils/open-olva-label";
import { OlvaNiubizCheckoutButton } from "./OlvaNiubizCheckoutButton";

interface OlvaResultRowProps {
  result: OlvaBulkShipmentResult;
  order: OrderDetail | undefined;
  onShareWhatsApp: (order: OrderDetail, trackingNumber: string | null) => void;
}

const formatCost = (cost: number) => formatOlvaAmount(cost, OLVA_CURRENCIES.PEN);

/** What happened to one order of the lot, and what can be done next with it. */
export function OlvaResultRow({ result, order, onShareWhatsApp }: OlvaResultRowProps) {
  const [isOpeningLabel, setIsOpeningLabel] = useState(false);
  const regeneratePaymentLink = useRegenerateOlvaShipmentPaymentLink();
  const created = result.status === "created" ? result.shipment : null;
  // While the shipment waits for payment (or its link expired) follow it: it re-reads itself every
  // few seconds until paid, and a regenerated link lands in the same cache entry
  const isAwaitingPayment =
    created?.status === OLVA_SHIPMENT_STATUSES.PENDING_PAYMENT ||
    created?.status === OLVA_SHIPMENT_STATUSES.PAYMENT_EXPIRED;
  const live = useOlvaShipment(isAwaitingPayment ? created?.id : null);
  const title = order ? `Pedido ${order.orderNumber}` : `Pedido ${result.itemKey}`;

  const openLabel = async (label: OlvaShipmentLabel | null, shipmentId: string | undefined) => {
    setIsOpeningLabel(true);

    try {
      // The label only comes with the creation answer; if it is gone, Olva can still serve it
      const resolved = label ?? (shipmentId ? await getOlvaShipmentLabel(shipmentId) : null);

      if (!resolved) {
        toast.error("No hay rótulo disponible para este envío.");
      } else if (!openOlvaLabel(resolved)) {
        toast.error("El navegador bloqueó la ventana del rótulo. Permite las ventanas emergentes.");
      }
    } catch (error) {
      toast.error(getOlvaShipmentErrorMessage(error));
    } finally {
      setIsOpeningLabel(false);
    }
  };

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

  const shipment = live.data ?? created;
  const registered = result.status === "registered_not_saved" ? result.registeredInOlva : null;
  const trackingNumber = shipment?.trackingNumber ?? registered?.trackingNumber ?? null;
  const cost = shipment?.cost ?? registered?.cost ?? 0;
  const payment = shipment?.payment ?? registered?.payment ?? null;
  const status = shipment?.status ?? registered?.status;
  const registrationNumber = shipment?.registrationNumber ?? registered?.registrationNumber;

  return (
    <li className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        {registered ? (
          <Badge variant="destructive">Registrado sin guardar</Badge>
        ) : (
          <Badge>{status ? getOlvaShipmentStatusLabel(status) : "Creado"}</Badge>
        )}
      </div>

      {registered ? (
        <Alert variant="destructive">
          <AlertDescription>
            {OLVA_SHIPMENT_ERROR_MESSAGES[OLVA_SHIPMENT_ERROR_CODES.NOT_PERSISTED]}
          </AlertDescription>
        </Alert>
      ) : null}

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs">Seguimiento</dt>
          <dd>{trackingNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Costo</dt>
          <dd>{formatCost(cost)}</dd>
        </div>
        {payment && isOlvaPagoEfectivoPayment(payment) && payment.cipCode ? (
          <div>
            <dt className="text-muted-foreground text-xs">Código CIP</dt>
            <dd>{payment.cipCode}</dd>
          </div>
        ) : null}
        {payment?.paid ? (
          <div>
            <dt className="text-muted-foreground text-xs">Pago</dt>
            <dd>Pagado</dd>
          </div>
        ) : null}
        {shipment?.securityPin ? (
          <div>
            <dt className="text-muted-foreground text-xs">PIN de recojo</dt>
            <dd>{shipment.securityPin}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isOpeningLabel}
          onClick={() => openLabel(result.label, shipment?.id)}
        >
          {isOpeningLabel ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <FileText className="mr-1 size-4" />
          )}
          Rótulo Olva
        </Button>
        {payment && isOlvaPagoEfectivoPayment(payment) && payment.url ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={payment.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 size-4" />
              Link de pago
            </a>
          </Button>
        ) : null}
        {payment && isOlvaNiubizPayment(payment) ? (
          <OlvaNiubizCheckoutButton payment={payment} registrationNumber={registrationNumber} />
        ) : null}
        {shipment && canRegenerateOlvaPaymentLink(shipment.status) ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={regeneratePaymentLink.isPending}
            onClick={() => regeneratePaymentLink.mutate(shipment.id)}
          >
            {regeneratePaymentLink.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : null}
            Generar nuevo pago
          </Button>
        ) : null}
        {order && shipment ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            title="Enviar seguimiento por WhatsApp"
            onClick={() => onShareWhatsApp(order, trackingNumber)}
          >
            <WhatsAppIcon className="mr-1 size-4" />
            WhatsApp
          </Button>
        ) : null}
      </div>
    </li>
  );
}
