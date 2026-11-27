import type { SunatDocument } from "../models/sunat-document.model";

export interface VoidStatusBadge {
  label: string;
  className: string;
  detalle?: string;
}

/** "2026-12-04" → "04/12/2026". */
export function formatVoidDeadline(deadline: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : deadline;
}

/** Badge of the comunicación de baja, or null when nobody asked to void the document. */
export function getVoidStatusBadge(
  document: Pick<
    SunatDocument,
    "voidStatus" | "voidReason" | "voidSunatCode" | "voidSunatDescription"
  >,
): VoidStatusBadge | null {
  switch (document.voidStatus) {
    case "IN_PROCESS":
      return {
        label: "Baja en proceso",
        className:
          "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
        detalle: "SUNAT está revisando la comunicación de baja.",
      };
    case "VOIDED":
      return {
        label: "De baja",
        className:
          "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
        detalle: document.voidReason ? `Motivo: ${document.voidReason}` : undefined,
      };
    case "REJECTED":
      return {
        label: "Baja rechazada",
        className: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
        detalle:
          [document.voidSunatCode, document.voidSunatDescription].filter(Boolean).join(" · ") ||
          "SUNAT rechazó la comunicación de baja.",
      };
    default:
      return null;
  }
}
