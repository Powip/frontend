import { useState } from "react";
import { toast } from "sonner";
import type { OlvaBulkShipmentResult } from "@/features/olva/olva-shipment/models/olva-bulk-shipment-result";
import { getOlvaShipmentLabel } from "@/features/olva/olva-shipment/services/olva-shipment.service";
import { collectOlvaLabels } from "../utils/collect-olva-labels";
import { mergeOlvaLabelPdfs } from "../utils/merge-olva-label-pdfs";
import { printPdfBlob } from "../utils/print-pdf-blob";

/** Prints the Olva labels (rótulos) of a whole lot as one PDF. */
export function usePrintOlvaLabels() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = async (results: readonly OlvaBulkShipmentResult[]) => {
    setIsPrinting(true);

    try {
      const { labels, missingItemKeys } = await collectOlvaLabels(results, getOlvaShipmentLabel);

      if (labels.length === 0) {
        toast.error("No hay rótulos de Olva disponibles para imprimir.");
        return;
      }

      printPdfBlob(await mergeOlvaLabelPdfs(labels));

      if (missingItemKeys.length > 0) {
        toast.warning(
          `No se pudo obtener el rótulo de ${missingItemKeys.length} envío(s). Impórtalos desde su fila con "Rótulo Olva".`,
        );
      }
    } catch {
      toast.error("No se pudieron preparar los rótulos para imprimir.");
    } finally {
      setIsPrinting(false);
    }
  };

  return { print, isPrinting };
}
