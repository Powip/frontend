import type { SunatDocumentCdrStatus } from "../../sunat-document/enums/sunat-document.enums";

export type TaxDocumentStatus = SunatDocumentCdrStatus | "SIN_EMITIR";

export interface TaxDocumentStatusMeta {
  label: string;
  badgeClassName: string;
  description: string;
  who: string;
}

export const TAX_DOCUMENT_STATUSES: Record<TaxDocumentStatus, TaxDocumentStatusMeta> = {
  SIN_EMITIR: {
    label: "Sin emitir",
    badgeClassName: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    description: "El comprobante todavía no ha sido enviado a SUNAT.",
    who: "Sistema",
  },

  PENDING: {
    label: "Enviado a SUNAT",
    badgeClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse",
    description: "El comprobante fue enviado directamente a SUNAT y está esperando el CDR.",
    who: "Sistema → SUNAT",
  },

  ACCEPTED: {
    label: "Aceptada",
    badgeClassName: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    description: "CDR recibido con estado 0. Comprobante válido ante SUNAT.",
    who: "SUNAT",
  },

  ACCEPTED_WITH_OBSERVATION: {
    label: "Aceptada con observación",
    badgeClassName:
      "bg-gradient-to-r from-green-100 to-amber-100 text-green-700 border-amber-200 dark:from-green-950 dark:to-amber-950 dark:text-green-300 dark:border-amber-800",
    description: "CDR aceptado con observación. El comprobante es válido ante SUNAT.",
    who: "SUNAT",
  },

  REJECTED: {
    label: "Rechazada",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    description: "CDR recibido con código de error. El comprobante no es válido ante SUNAT.",
    who: "SUNAT",
  },

  RETRY_EXCEEDED: {
    label: "Reintentos agotados",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    description: "Se agotaron los intentos para obtener el CDR de SUNAT.",
    who: "Sistema",
  },
};
