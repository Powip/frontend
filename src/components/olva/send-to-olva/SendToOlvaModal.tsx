"use client";

import type { OrderDetail, ShippingGuide } from "@/components/modals/GuideDetailsModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SendToOlvaBody } from "./components/SendToOlvaBody";
import { useOlvaActiveShipmentsByOrder } from "./hooks/use-olva-active-shipments-by-order";

const NO_SHIPMENTS = new Map<string, never>();

export interface SendToOlvaModalProps {
  open: boolean;
  onClose: () => void;
  orders: OrderDetail[];
  /** Called as soon as Olva registered something, so the guide can refresh behind the modal. */
  onSuccess?: () => void;
  guideId?: string;
  companyId?: string;
  guide?: ShippingGuide | null;
}

/**
 * Registers the orders of a guide as Olva shipments, in one lot. The container only decides what
 * to show: it waits for the guide's existing shipments, then hands over to `SendToOlvaBody`.
 */
export default function SendToOlvaModal({
  open,
  onClose,
  orders,
  onSuccess,
  guideId,
  companyId,
  guide,
}: SendToOlvaModalProps) {
  const guideKey = open ? guideId || undefined : undefined;
  const { activeByOrder, isSettled } = useOlvaActiveShipmentsByOrder(guideKey);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
        // A stray click outside must not throw away a half-filled lot
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Registrar envíos en Olva</DialogTitle>
          <DialogDescription>
            {guide?.guideNumber ? `Guía ${guide.guideNumber} · ` : ""}
            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
          </DialogDescription>
        </DialogHeader>

        {open && isSettled ? (
          <SendToOlvaBody
            orders={orders}
            activeByOrder={activeByOrder ?? NO_SHIPMENTS}
            guideId={guideId || undefined}
            companyId={companyId || undefined}
            guide={guide}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}
