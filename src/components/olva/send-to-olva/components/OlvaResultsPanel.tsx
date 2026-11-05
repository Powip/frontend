"use client";

import { Loader2, Printer } from "lucide-react";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import { Button } from "@/components/ui/button";
import { formatOlvaAmount } from "@/features/olva/olva-quote/utils/format-olva-amount";
import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import { splitOlvaBulkResults } from "@/features/olva/olva-shipment/utils/split-olva-bulk-results";
import { OLVA_CURRENCIES } from "@/features/olva/shared/constants/olva-enums.constants";
import { getOlvaResultsCost } from "../utils/get-olva-results-cost";
import { OlvaResultRow } from "./OlvaResultRow";

interface OlvaResultsPanelProps {
  results: readonly OlvaBulkShipmentResult[];
  ordersById: ReadonlyMap<string, OrderDetail>;
  retryableCount: number;
  isPrinting: boolean;
  isPrintingOlvaLabels: boolean;
  onRetry: () => void;
  onClose: () => void;
  onPrintLabels: (orders: OrderDetail[]) => void;
  onPrintGuide: (orders: OrderDetail[]) => void;
  onPrintOlvaLabels: () => void;
  onShareWhatsApp: (order: OrderDetail, trackingNumber: string | null) => void;
}

/** The outcome of the lot: one row per order, the real cost, and the follow-up actions. */
export function OlvaResultsPanel({
  results,
  ordersById,
  retryableCount,
  isPrinting,
  isPrintingOlvaLabels,
  onRetry,
  onClose,
  onPrintLabels,
  onPrintGuide,
  onPrintOlvaLabels,
  onShareWhatsApp,
}: OlvaResultsPanelProps) {
  const { created, registeredNotSaved, failed } = splitOlvaBulkResults(results);
  const createdOrders = created.flatMap((result) => {
    const order = ordersById.get(result.itemKey);

    return order ? [order] : [];
  });

  const olvaLabelCount = created.length + registeredNotSaved.length;

  return (
    <div className="grid gap-4">
      <p className="text-sm" aria-live="polite">
        <span className="font-semibold">{created.length}</span> creados
        {registeredNotSaved.length > 0 ? `, ${registeredNotSaved.length} sin guardar` : ""}
        {failed.length > 0 ? `, ${failed.length} con error` : ""}. Costo total:{" "}
        <span className="font-semibold">
          {formatOlvaAmount(getOlvaResultsCost(results), OLVA_CURRENCIES.PEN)}
        </span>
      </p>

      <ul className="grid gap-2">
        {results.map((result) => (
          <OlvaResultRow
            key={result.itemKey}
            result={result}
            order={ordersById.get(result.itemKey)}
            onShareWhatsApp={onShareWhatsApp}
          />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPrinting || createdOrders.length === 0}
            onClick={() => onPrintLabels(createdOrders)}
          >
            {isPrinting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Printer className="mr-2 size-4" />
            )}
            Imprimir etiquetas
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPrinting || createdOrders.length === 0}
            onClick={() => onPrintGuide(createdOrders)}
          >
            <Printer className="mr-2 size-4" />
            Imprimir guía de salida
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPrintingOlvaLabels || olvaLabelCount === 0}
            onClick={onPrintOlvaLabels}
          >
            {isPrintingOlvaLabels ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Printer className="mr-2 size-4" />
            )}
            Imprimir rótulos Olva ({olvaLabelCount})
          </Button>
        </div>
        <div className="flex gap-2">
          {retryableCount > 0 ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              Corregir y reintentar ({retryableCount})
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
