import axios from "axios";

/**
 * Body shape returned by the sunat-integration backend's GlobalExceptionFilter
 * for ApplicationError subclasses, e.g.:
 * { "statusCode": 404, "code": "SUNAT_DOCUMENT_SEQUENCE_NOT_FOUND", "message": "..." }
 *
 * See application/errors/sunat-document-sequence.errors.ts on the backend
 * for the full set of codes this feature can throw.
 */
interface SunatDocumentSequenceErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
}

const MESSAGES_BY_CODE: Record<string, string> = {
  SUNAT_DOCUMENT_SEQUENCE_NOT_FOUND:
    "La serie ya no existe o fue eliminada. Refresca la página e intenta nuevamente.",
  SUNAT_DOCUMENT_SEQUENCE_CANNOT_MOVE_BACKWARDS:
    "El correlativo ingresado es menor al que ya se utilizó para esta serie.",
  INVALID_LAST_CORRELATIVE: "El último correlativo no puede ser negativo.",
};

const FALLBACK_MESSAGE = "Ocurrió un error. Intenta de nuevo en unos momentos.";

/**
 * Turns any error thrown by the initialize/delete/set-default mutations
 * into a message ready to show the user (e.g. via toast.error). Centralized
 * here - the same way getIdentityLookupErrorMessage centralizes it for
 * identity-lookup - so every call site shows consistent wording instead of
 * leaking raw axios text like "Request failed with status code 404".
 */
export function getSunatDocumentSequenceErrorMessage(error: unknown): string {
  if (axios.isAxiosError<SunatDocumentSequenceErrorBody>(error)) {
    const code = error.response?.data?.code;

    if (code && code in MESSAGES_BY_CODE) {
      return MESSAGES_BY_CODE[code];
    }

    const backendMessage = error.response?.data?.message;

    if (typeof backendMessage === "string" && backendMessage.length > 0) {
      return backendMessage;
    }
  }

  return FALLBACK_MESSAGE;
}
