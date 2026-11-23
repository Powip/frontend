import axios from "axios";

/**
 * Body shape returned by the sunat backend's GlobalExceptionFilter, e.g.
 * { "statusCode": 409, "code": "SUNAT_PROFILE_DEFAULT_CANNOT_BE_DELETED", "message": "..." }
 */
interface SunatProfileErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
}

const MESSAGES_BY_CODE: Record<string, string> = {
  CERTIFICATE_PASSWORD_INVALID: "La contraseña del certificado es incorrecta.",
  CERTIFICATE_INVALID: "El archivo no es un certificado digital válido (.p12 o .pfx).",
  CERTIFICATE_PARSING_FAILED: "El archivo no es un certificado digital válido (.p12 o .pfx).",
  CERTIFICATE_MISSING: "Selecciona el archivo del certificado.",
  CERTIFICATE_PASSWORD_MISSING: "Ingresa la contraseña del certificado.",
  SUNAT_PROFILE_NOT_FOUND:
    "El certificado ya no existe o fue eliminado. Refresca la página e intenta nuevamente.",
  SUNAT_RUC_LIMIT_REACHED:
    "Tu cuenta llegó al límite de RUC activos. Agrega un RUC extra (S/ 30/mes) para poder usar otro.",
  SUNAT_RUC_ALLOWANCE_UNAVAILABLE:
    "No pudimos comprobar cuántos RUC tienes pagados. Intenta de nuevo en un momento.",
  SUNAT_PROFILE_DEFAULT_CANNOT_BE_DEACTIVATED:
    "No puedes desactivar el RUC predeterminado. Marca otro como predeterminado primero.",
  SUNAT_PROFILE_DEFAULT_CANNOT_BE_DELETED:
    "No puedes eliminar el certificado predeterminado mientras tengas otros. Marca otro como predeterminado primero.",
};

/** El servidor respondió que no hay un cupo de RUC libre (402): hay que pagar un RUC extra. */
export function isRucLimitError(error: unknown): boolean {
  return (
    axios.isAxiosError<SunatProfileErrorBody>(error) &&
    error.response?.data?.code === "SUNAT_RUC_LIMIT_REACHED"
  );
}

const FALLBACK_MESSAGE = "Ocurrió un error. Intenta de nuevo en unos momentos.";

/**
 * Turns an error thrown by the replace-certificate / delete mutations into a
 * message ready to show the user, instead of leaking raw axios text such as
 * "Request failed with status code 409".
 */
export function getSunatProfileErrorMessage(error: unknown): string {
  if (axios.isAxiosError<SunatProfileErrorBody>(error)) {
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
