import axios from "axios";

/**
 * Body shape returned by the sunat-integration backend's GlobalExceptionFilter
 * for ApplicationError subclasses, e.g.:
 * { "statusCode": 404, "code": "IDENTITY_NOT_FOUND", "message": "..." }
 */
interface IdentityLookupErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
}

const MESSAGES_BY_CODE: Record<string, string> = {
  IDENTITY_NOT_FOUND: "No se encontraron datos para ese documento.",
  IDENTITY_LOOKUP_RATE_LIMITED:
    "El servicio de verificación está saturado por el momento. Intenta de nuevo en unos segundos.",
  IDENTITY_LOOKUP_PROVIDER_UNAVAILABLE:
    "El servicio de verificación RENIEC/SUNAT no está disponible en este momento.",
  IDENTITY_LOOKUP_PROVIDER_MISCONFIGURED:
    "El servicio de verificación no está configurado correctamente. Contacta a soporte.",
};

const FALLBACK_MESSAGE = "No se pudo verificar el documento. Intenta de nuevo.";

/**
 * Turns any error thrown by useLookupIdentity into a message ready to show
 * the user (e.g. via toast.error). Centralized here so every call site -
 * the modal today, anything else that reuses this feature tomorrow - shows
 * the same wording for the same failure.
 */
export function getIdentityLookupErrorMessage(error: unknown): string {
  if (axios.isAxiosError<IdentityLookupErrorBody>(error)) {
    const code = error.response?.data?.code;

    if (code && code in MESSAGES_BY_CODE) {
      return MESSAGES_BY_CODE[code];
    }

    if (error.response?.status === 400) {
      return error.response?.data?.message ?? "El número de documento no es válido.";
    }
  }

  return FALLBACK_MESSAGE;
}
