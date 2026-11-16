import type { SunatDocumentBulkErrorResponseDto } from "../dto/sunat-documents-response.dto";

/**
 * The emission endpoint answers 201 even when a document could not be
 * created: the failure travels inside `results[].error`. These are the
 * backend codes a user can act on, in plain Spanish.
 */
const EMISSION_ERROR_MESSAGES: Record<string, string> = {
  SUNAT_ORDER_ALREADY_HAS_DOCUMENT: "Esta venta ya tiene un comprobante emitido.",
  SUNAT_PROFILE_INACTIVE: "El RUC elegido está inactivo y no puede emitir.",
  SUNAT_PROFILE_NOT_FOUND: "El RUC elegido ya no existe. Actualiza la página y vuelve a elegirlo.",
  SUNAT_DEFAULT_PROFILE_NOT_FOUND:
    "No hay un RUC predeterminado. Elige uno en la pestaña Emisores (RUC).",
  SUNAT_DOCUMENT_SEQUENCE_NOT_INITIALIZED:
    "Este RUC no tiene esa serie configurada. Agrégala en Series y Correlativos.",
  SUNAT_REFERENCE_DOCUMENT_ISSUER_MISMATCH:
    "La nota debe emitirse con el mismo RUC del comprobante que corrige.",
  SUNAT_REFERENCE_DOCUMENT_ISSUER_UNAVAILABLE:
    "El RUC que emitió el comprobante original ya no está activo en tu empresa.",
  SUNAT_REFERENCE_DOCUMENT_NOT_FOUND: "No se encontró el comprobante original.",
};

export const GENERIC_EMISSION_ERROR_MESSAGE =
  "No se pudo crear el comprobante. Revisa los datos e intenta nuevamente.";

export function getEmissionErrorMessage(error: SunatDocumentBulkErrorResponseDto): string {
  return EMISSION_ERROR_MESSAGES[error.error.code] ?? GENERIC_EMISSION_ERROR_MESSAGE;
}
