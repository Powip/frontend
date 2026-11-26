"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, FileText, Loader2, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OLVA_SHIPMENT_ERROR_CODES } from "@/features/olva/olva-shipment/constants/olva-shipment-error-codes.constants";
import { useDiscardOlvaShipment } from "@/features/olva/olva-shipment/hooks/use-discard-olva-shipment";
import { useRegenerateOlvaShipmentPaymentLink } from "@/features/olva/olva-shipment/hooks/use-regenerate-olva-shipment-payment-link";
import { useRetryOlvaShipment } from "@/features/olva/olva-shipment/hooks/use-retry-olva-shipment";
import { olvaShipmentKeys } from "@/features/olva/olva-shipment/keys/olva-shipment.keys";
import type {
  OlvaShipment,
  OlvaShipmentSummary,
} from "@/features/olva/olva-shipment/models/olva-shipment";
import type { OlvaShipmentLabel } from "@/features/olva/olva-shipment/models/olva-shipment-label";
import { olvaShipmentQueries } from "@/features/olva/olva-shipment/queries/olva-shipment.queries";
import { getOlvaShipmentLabel } from "@/features/olva/olva-shipment/services/olva-shipment.service";
import { canRegenerateOlvaPaymentLink } from "@/features/olva/olva-shipment/utils/can-regenerate-olva-payment-link";
import { getOlvaShipmentStatusLabel } from "@/features/olva/olva-shipment/utils/get-olva-shipment-status-label";
import {
  getOlvaShipmentErrorMessage,
  OLVA_SHIPMENT_ERROR_MESSAGES,
} from "@/features/olva/olva-shipment/utils/olva-shipment-error.util";
import {
  OLVA_SHIPMENT_STATUSES,
  type OlvaShipmentStatus,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { getOlvaErrorCode } from "@/features/olva/shared/utils/olva-error.util";
import { OlvaNiubizCheckoutButton } from "./send-to-olva/components/OlvaNiubizCheckoutButton";
import {
  isOlvaNiubizPayment,
  isOlvaPagoEfectivoPayment,
} from "./send-to-olva/utils/olva-payment-guards";
import { openOlvaLabel } from "./send-to-olva/utils/open-olva-label";

const S = OLVA_SHIPMENT_STATUSES;

/** Statuses an action can change (retry, pay, discard): the cell listens to the shipment's cache. */
const FOLLOWED_STATUSES: readonly OlvaShipmentStatus[] = [
  S.SUBMITTING,
  S.PENDING_PAYMENT,
  S.PAYMENT_EXPIRED,
];
/** The list carries no payment: these read the detail, which re-reads itself until paid. */
const PAYMENT_STATUSES: readonly OlvaShipmentStatus[] = [S.PENDING_PAYMENT, S.PAYMENT_EXPIRED];
/** No guide at Olva: nothing to print. */
const WITHOUT_LABEL: readonly OlvaShipmentStatus[] = [S.SUBMITTING, S.FAILED, S.DISCARDED, S.DRAFT];
const DANGER: readonly OlvaShipmentStatus[] = [S.FAILED, S.REJECTED, S.INCIDENT, S.RETURNED];
const WAITING: readonly OlvaShipmentStatus[] = [
  S.SUBMITTING,
  S.PENDING_PAYMENT,
  S.PAYMENT_EXPIRED,
  S.DISCARDED,
  S.DRAFT,
  S.UNKNOWN,
];

const COUNTDOWN_TICK_MS = 30_000;

interface OlvaShipmentCellProps {
  /** A list row (guide) or a full shipment; null when the order has no Olva shipment. */
  shipment: OlvaShipmentSummary | OlvaShipment | null;
  /** The label that came with the creation answer: opened without asking Olva again. */
  label?: OlvaShipmentLabel | null;
}

/**
 * The state of an order's Olva shipment and what can be done with it: print its label, pay it
 * (PagoEfectivo CIP, link or QR), ask for a new payment or discard it once expired, and retry a
 * registration Olva did not confirm.
 */
export function OlvaShipmentCell({ shipment, label = null }: OlvaShipmentCellProps) {
  if (!shipment) return null;

  return <OlvaShipmentCellBody shipment={shipment} label={label} />;
}

function OlvaShipmentCellBody({
  shipment,
  label,
}: {
  shipment: OlvaShipmentSummary | OlvaShipment;
  label: OlvaShipmentLabel | null;
}) {
  const queryClient = useQueryClient();
  const followedId = FOLLOWED_STATUSES.includes(shipment.status) ? shipment.id : null;
  const cached = followedId
    ? queryClient.getQueryData<OlvaShipment>(olvaShipmentKeys.detail(followedId))
    : undefined;
  // A registration being verified only listens to what «Reintentar» answers (no request of its own)
  const live = useQuery({
    ...olvaShipmentQueries.detail(followedId),
    enabled: Boolean(followedId) && PAYMENT_STATUSES.includes((cached ?? shipment).status),
  });
  const current: OlvaShipmentSummary | OlvaShipment = live.data ?? shipment;
  // Only a detail carries the payment; a list row has none
  const payment = (current as Partial<OlvaShipment>).payment ?? null;
  const status = current.status;

  return (
    <div className="grid gap-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariantOf(status)} title={current.statusDetail ?? undefined}>
          {getOlvaShipmentStatusLabel(status)}
        </Badge>
        {current.trackingNumber ? (
          <span className="font-mono text-xs">{current.trackingNumber}</span>
        ) : null}
        {WITHOUT_LABEL.includes(status) ? null : (
          <LabelButton shipmentId={current.id} label={label} />
        )}
      </div>

      {status === S.SUBMITTING ? <SubmittingNotice shipment={current} /> : null}

      {status === S.FAILED && current.failureReason ? (
        <p className="text-destructive text-xs">{current.failureReason}</p>
      ) : null}

      {status === S.PENDING_PAYMENT && payment && isOlvaPagoEfectivoPayment(payment) ? (
        <PagoEfectivoDetails
          cipCode={payment.cipCode}
          url={payment.url}
          qrImage={payment.qrImage}
          expiresAt={payment.expiresAt}
        />
      ) : null}

      {status === S.PENDING_PAYMENT && payment && isOlvaNiubizPayment(payment) ? (
        <div>
          <OlvaNiubizCheckoutButton
            payment={payment}
            registrationNumber={current.registrationNumber}
          />
        </div>
      ) : null}

      {payment?.paid ? <p className="text-xs font-medium">Pagado</p> : null}

      {canRegenerateOlvaPaymentLink(status) || status === S.PAYMENT_EXPIRED ? (
        <ExpiredPaymentActions shipmentId={current.id} status={status} />
      ) : null}
    </div>
  );
}

function badgeVariantOf(status: OlvaShipmentStatus) {
  if (DANGER.includes(status)) return "destructive" as const;
  if (WAITING.includes(status)) return "secondary" as const;
  return "default" as const;
}

function LabelButton({
  shipmentId,
  label,
}: {
  shipmentId: string;
  label: OlvaShipmentLabel | null;
}) {
  const [isOpening, setIsOpening] = useState(false);

  const open = async () => {
    setIsOpening(true);

    try {
      // The label only comes with the creation answer; if it is gone, Olva can still serve it
      const resolved = label ?? (await getOlvaShipmentLabel(shipmentId));

      if (!openOlvaLabel(resolved)) {
        toast.error("El navegador bloqueó la ventana del rótulo. Permite las ventanas emergentes.");
      }
    } catch (error) {
      toast.error(getOlvaShipmentErrorMessage(error));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" disabled={isOpening} onClick={open}>
      {isOpening ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : (
        <FileText className="mr-1 size-4" />
      )}
      Rótulo Olva
    </Button>
  );
}

function SubmittingNotice({ shipment }: { shipment: OlvaShipmentSummary }) {
  const retry = useRetryOlvaShipment();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = (confirmed: boolean) =>
    retry.mutate(confirmed ? { id: shipment.id, confirmed: true } : { id: shipment.id }, {
      onError: (error) => {
        // Past an hour the backend wants the store to check the guide at Olva first
        if (getOlvaErrorCode(error) === OLVA_SHIPMENT_ERROR_CODES.MANUAL_REVIEW) {
          setConfirmOpen(true);
        }
      },
    });

  return (
    <div className="grid gap-1.5">
      <p className="text-xs">
        Verificando con Olva. No lo registres de nuevo: se confirma solo en unos minutos o con
        «Reintentar».
      </p>
      {shipment.failureReason ? (
        <p className="text-muted-foreground text-xs">{shipment.failureReason}</p>
      ) : null}
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retry.isPending}
          onClick={() => run(false)}
        >
          {retry.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <RotateCw className="mr-1 size-4" />
          )}
          Reintentar
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revisa en Olva antes de reintentar</AlertDialogTitle>
            <AlertDialogDescription>
              {OLVA_SHIPMENT_ERROR_MESSAGES[OLVA_SHIPMENT_ERROR_CODES.MANUAL_REVIEW]} Si la guía ya
              existe en Olva, no reintentes: avísanos para vincularla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(true)}>Ya revisé, reintentar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PagoEfectivoDetails({
  cipCode,
  url,
  qrImage,
  expiresAt,
}: {
  cipCode?: string;
  url?: string;
  qrImage?: string;
  expiresAt?: Date;
}) {
  const copyCip = async (cip: string) => {
    try {
      await navigator.clipboard.writeText(cip);
      toast.success("CIP copiado.");
    } catch {
      toast.error("No se pudo copiar el CIP. Cópialo a mano.");
    }
  };

  return (
    <div className="grid gap-1.5">
      {cipCode ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">CIP</span>
          <span className="font-mono font-semibold">{cipCode}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Copiar CIP"
            title="Copiar CIP"
            onClick={() => copyCip(cipCode)}
          >
            <Copy className="size-4" />
          </Button>
        </div>
      ) : null}
      {expiresAt ? <PaymentCountdown expiresAt={expiresAt} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {url ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 size-4" />
              Link de pago
            </a>
          </Button>
        ) : null}
      </div>
      {qrImage ? (
        // biome-ignore lint/performance/noImgElement: a data URI from Olva, not an optimizable asset
        <img src={toQrSource(qrImage)} alt="QR de pago" className="size-32 rounded border" />
      ) : null}
    </div>
  );
}

/** Olva may send the QR as a data URI, a URL or bare base64. */
function toQrSource(qrImage: string): string {
  return /^(data:|https?:)/.test(qrImage) ? qrImage : `data:image/png;base64,${qrImage}`;
}

function PaymentCountdown({ expiresAt }: { expiresAt: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const remainingMinutes = Math.floor((expiresAt.getTime() - now) / 60_000);
  const at = expiresAt.toLocaleString("es-PE", { timeZone: "America/Lima" });

  if (remainingMinutes < 0) {
    return (
      <p className="text-destructive text-xs" title={at}>
        El pago venció
      </p>
    );
  }

  const hours = String(Math.floor(remainingMinutes / 60)).padStart(2, "0");
  const minutes = String(remainingMinutes % 60).padStart(2, "0");

  return (
    <p className="text-muted-foreground text-xs" title={`Vence el ${at}`}>
      {`Vence en ${hours}:${minutes}`}
    </p>
  );
}

function ExpiredPaymentActions({
  shipmentId,
  status,
}: {
  shipmentId: string;
  status: OlvaShipmentStatus;
}) {
  const regenerate = useRegenerateOlvaShipmentPaymentLink();
  const discard = useDiscardOlvaShipment();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={regenerate.isPending}
        onClick={() => regenerate.mutate(shipmentId)}
      >
        {regenerate.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
        Generar nuevo pago
      </Button>
      {status === S.PAYMENT_EXPIRED ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={discard.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Descartar
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este envío?</AlertDialogTitle>
            <AlertDialogDescription>
              El pago venció. Al descartarlo, el pedido queda libre para registrarlo de nuevo en
              Olva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => discard.mutate(shipmentId)}>
              Descartar envío
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
