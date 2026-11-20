import { formatMotivoNota, getCodigoMotivoNc } from "@/app/facturacion/lib/motivos-nota-credito";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import type { DownloadFileResult } from "@/types/download-file.types";
import { downloadFile } from "@/utils/http/download-file";

/** "FC01-00000001". */
export function getNotaNumero(nota: Pick<SunatDocument, "series" | "correlative">): string {
  return `${nota.series}-${nota.correlative}`;
}

/** Número del comprobante que modifica la nota, o "—" si ya no está en la lista. */
export function getNotaOriginal(nota: SunatDocument, documents: readonly SunatDocument[]): string {
  const original = documents.find((document) => document.id === nota.referenceDocumentId);
  return original ? getNotaNumero(original) : "—";
}

/** "06 · Devolución total", con el motivo que se envió a SUNAT. */
export function getNotaMotivo(nota: SunatDocument): string {
  const reason = nota.taxDocumentPayload?.discrepancyResponse;
  if (!reason) return "—";
  return formatMotivoNota({
    motivo: reason.reasonDescription,
    motivoCodigo: reason.reasonCode || getCodigoMotivoNc(reason.reasonDescription),
  });
}

/** "2026-11-19" → "19/11/2026". */
export function formatNotaFecha(issueDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(issueDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : issueDate;
}

export interface NotaEstado {
  label: string;
  className: string;
  detalle?: string;
}

/** Estado real de la nota según la respuesta (CDR) de SUNAT. */
export function getNotaEstado(nota: SunatDocument): NotaEstado {
  const detalle = [nota.sunatCode, nota.sunatDescription].filter(Boolean).join(" · ") || undefined;

  switch (nota.cdrStatus) {
    case "ACCEPTED":
      return {
        label: "Aceptado",
        className: "bg-green-100 text-green-700 hover:bg-green-100",
        detalle,
      };
    case "ACCEPTED_WITH_OBSERVATION":
      return {
        label: "Aceptado c/ obs.",
        className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
        detalle: nota.observations ?? detalle,
      };
    case "REJECTED":
      return { label: "Rechazado", className: "bg-red-100 text-red-700 hover:bg-red-100", detalle };
    case "RETRY_EXCEEDED":
      return {
        label: "Sin respuesta de SUNAT",
        className: "bg-red-100 text-red-700 hover:bg-red-100",
        detalle: detalle ?? "SUNAT no respondió tras varios intentos.",
      };
    default:
      return {
        label: "Enviando a SUNAT",
        className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
        detalle: "La nota está en cola de envío a SUNAT.",
      };
  }
}

/** Solo las notas aceptadas por SUNAT tienen representación impresa válida. */
export function isNotaImprimible(nota: SunatDocument): boolean {
  return nota.cdrStatus === "ACCEPTED" || nota.cdrStatus === "ACCEPTED_WITH_OBSERVATION";
}

/**
 * Abre el PDF real (generado por el backend) en una pestaña nueva para
 * imprimirlo. La pestaña se abre antes de pedir el PDF para que el navegador
 * no la bloquee como popup; si aun así se bloquea, el PDF se descarga.
 */
export async function abrirPdfNota(load: () => Promise<DownloadFileResult>): Promise<void> {
  const tab = window.open("", "_blank");

  let file: DownloadFileResult;
  try {
    file = await load();
  } catch (error) {
    tab?.close();
    throw error;
  }

  if (!tab) {
    downloadFile(file);
    return;
  }

  tab.location.href = window.URL.createObjectURL(file.blob);
}

/** Nota real en el formato que usa el Excel de Reportes. */
export function toNotaReporte(
  nota: SunatDocument,
  documents: readonly SunatDocument[],
): import("@/types/facturacion").Nota {
  const reason = nota.taxDocumentPayload?.discrepancyResponse;
  return {
    fecha: formatNotaFecha(nota.issueDate),
    num: getNotaNumero(nota),
    original: getNotaOriginal(nota, documents),
    cliente: nota.taxDocumentPayload?.customer?.name ?? "—",
    motivo: reason?.reasonDescription ?? "—",
    motivoCodigo: reason?.reasonCode,
    monto: Number(nota.taxDocumentPayload?.totals?.grandTotal ?? 0),
    rucEmisor: nota.rucIssuer,
    estado: getNotaEstado(nota).label,
  };
}
