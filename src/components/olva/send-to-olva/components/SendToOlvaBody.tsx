"use client";

import { useMemo, useState } from "react";
import type { OrderDetail, ShippingGuide } from "@/components/modals/GuideDetailsModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { OLVA_BULK_SHIPMENTS_MAX_SIZE } from "@/features/olva/olva-shipment/constants/olva-shipment.constants";
import type { OlvaShipmentSummary } from "@/features/olva/olva-shipment/models/olva-shipment";
import { OLVA_SHIPMENT_ERROR_MESSAGES } from "@/features/olva/olva-shipment/utils/olva-shipment-error.util";
import { SEND_TO_OLVA_VIEWS } from "../constants/send-to-olva.constants";
import { useOlvaPrintOrders } from "../hooks/use-olva-print-orders";
import { useOlvaWhatsappShare } from "../hooks/use-olva-whatsapp-share";
import { usePrintOlvaLabels } from "../hooks/use-print-olva-labels";
import { useSendToOlvaForm } from "../hooks/use-send-to-olva-form";
import { useSendToOlvaPhase } from "../hooks/use-send-to-olva-phase";
import { useSendToOlvaSubmit } from "../hooks/use-send-to-olva-submit";
import { buildOlvaFormDefaults } from "../utils/build-olva-form-defaults";
import { getOlvaUnresolvedItemKeys } from "../utils/get-olva-unresolved-item-keys";
import { OlvaAlreadyShippedNotice } from "./OlvaAlreadyShippedNotice";
import { OlvaLotForm } from "./OlvaLotForm";
import { OlvaResultsPanel } from "./OlvaResultsPanel";

interface SendToOlvaBodyProps {
  orders: readonly OrderDetail[];
  activeByOrder: ReadonlyMap<string, OlvaShipmentSummary>;
  guideId?: string;
  companyId?: string;
  guide?: ShippingGuide | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * The working part of the modal. It is mounted only once the guide's existing shipments are known
 * and unmounted on close, so its form always starts from the orders that are still to be sent.
 */
export function SendToOlvaBody({
  orders,
  activeByOrder,
  guideId,
  companyId,
  guide,
  onClose,
  onSuccess,
}: SendToOlvaBodyProps) {
  const eligibleOrders = useMemo(
    () => orders.filter((order) => !activeByOrder.has(order.id)),
    [orders, activeByOrder],
  );
  // Frozen at mount: the guide's shipments refetch after sending, but the rows are the form's now
  const [defaultValues] = useState(() => buildOlvaFormDefaults(eligibleOrders, { guideId }));
  const { form, fields, keepOnly } = useSendToOlvaForm(defaultValues);
  const phase = useSendToOlvaPhase();
  const { submit, isSubmitting } = useSendToOlvaSubmit({
    onResult: ({ summary, results }) => {
      phase.showResults(results);
      if (summary.created + summary.registeredNotSaved > 0) onSuccess?.();
    },
  });
  const printing = useOlvaPrintOrders({
    open: true,
    companyId,
    guideId,
    guide,
    orders,
  });
  const shareWhatsApp = useOlvaWhatsappShare();
  const olvaLabels = usePrintOlvaLabels();

  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const itemKeys = fields.map((field) => field.itemKey);
  const retryKeys = getOlvaUnresolvedItemKeys(itemKeys, phase.results);
  const previousErrors = new Map(
    phase.results.flatMap((result) =>
      result.status === "failed"
        ? [
            [
              result.itemKey,
              OLVA_SHIPMENT_ERROR_MESSAGES[result.error.code] ?? result.error.message,
            ] as const,
          ]
        : [],
    ),
  );

  const retry = () => {
    keepOnly(retryKeys);
    phase.backToEdit();
  };

  if (eligibleOrders.length === 0 && phase.results.length === 0) {
    return (
      <div className="grid gap-4">
        <Alert>
          <AlertDescription>
            Todos los pedidos seleccionados ya tienen un envío activo en Olva.
          </AlertDescription>
        </Alert>
        <OlvaAlreadyShippedNotice orders={orders} shipments={activeByOrder} />
        <Button type="button" className="justify-self-end" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    );
  }

  if (phase.view === SEND_TO_OLVA_VIEWS.RESULTS) {
    return (
      <OlvaResultsPanel
        results={phase.results}
        ordersById={ordersById}
        retryableCount={retryKeys.length}
        isPrinting={printing.isPrinting}
        isPrintingOlvaLabels={olvaLabels.isPrinting}
        onRetry={retry}
        onClose={onClose}
        onPrintLabels={printing.printLabels}
        onPrintGuide={printing.printGuide}
        onPrintOlvaLabels={() => olvaLabels.print(phase.results)}
        onShareWhatsApp={shareWhatsApp}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4">
        {eligibleOrders.length > OLVA_BULK_SHIPMENTS_MAX_SIZE ? (
          <Alert>
            <AlertDescription>
              Olva registra hasta {OLVA_BULK_SHIPMENTS_MAX_SIZE} envíos por lote. Se envían los
              primeros {OLVA_BULK_SHIPMENTS_MAX_SIZE}; vuelve a abrir este panel para el resto.
            </AlertDescription>
          </Alert>
        ) : null}
        <OlvaAlreadyShippedNotice orders={orders} shipments={activeByOrder} />
        <OlvaLotForm
          itemKeys={itemKeys}
          ordersById={ordersById}
          previousErrors={previousErrors}
          isSubmitting={isSubmitting}
          onRemove={(index) => keepOnly(itemKeys.filter((_, position) => position !== index))}
          onCancel={onClose}
        />
      </form>
    </Form>
  );
}
