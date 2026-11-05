import type { OlvaBulkCreateShipmentsResult } from "../models/olva-bulk-shipment-result";

export type OlvaBulkSummaryTone = "success" | "warning" | "error";

export interface OlvaBulkSummaryMessage {
  tone: OlvaBulkSummaryTone;
  message: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One sentence for the whole lot, ready for a toast, with the tone to show it in. */
export function getOlvaBulkSummaryMessage(
  summary: OlvaBulkCreateShipmentsResult["summary"],
): OlvaBulkSummaryMessage {
  const { total, created, registeredNotSaved, failed } = summary;

  // The worst case first: money may have been charged for something we cannot show
  if (registeredNotSaved > 0) {
    return {
      tone: "error",
      message: `${plural(registeredNotSaved, "envío se registró", "envíos se registraron")} en Olva pero no se pudo guardar. No los envíes de nuevo: contacta a soporte.`,
    };
  }

  if (failed === 0) {
    return {
      tone: "success",
      message: `${plural(created, "envío creado", "envíos creados")} correctamente.`,
    };
  }

  if (created === 0) {
    return {
      tone: "error",
      message: `No se pudo crear ${total === 1 ? "el envío" : "ningún envío"}. Revisa los errores e intenta de nuevo.`,
    };
  }

  return {
    tone: "warning",
    message: `${created} de ${total} envíos creados. ${plural(failed, "falló", "fallaron")}: corrígelos y reenvíalos.`,
  };
}
