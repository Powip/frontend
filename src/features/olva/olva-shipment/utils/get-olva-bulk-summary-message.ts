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
  const { total, created, unknown, failed } = summary;
  // First what must not be done twice: those may already exist at Olva
  if (unknown > 0) {
    return {
      tone: "warning",
      message:
        unknown === 1
          ? "1 envío se está verificando con Olva: no lo registres de nuevo. Se confirma solo o con «Reintentar»."
          : `${unknown} envíos se están verificando con Olva: no los registres de nuevo. Se confirman solos o con «Reintentar».`,
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
