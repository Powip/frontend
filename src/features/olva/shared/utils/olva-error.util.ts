import axios from "axios";
import { OLVA_ERROR_CODES } from "../constants/olva-error-codes.constants";

/**
 * Two body shapes can come back from ms-integrations:
 *
 * 1. OlvaExceptionFilter (business and upstream errors). EVERY one carries `details.code`:
 *    { "error": "...", "source": "olva", "details": { "code": "SENDER_PROFILE_DUPLICATE_RUC" },
 *      "statusCode": 409, "retryAfter": 30 }
 *    `retryAfter` (seconds) only comes with a rate limit, also as the `Retry-After` header.
 *
 * 2. ZodValidationPipe (400, invalid body, query or params):
 *    { "statusCode": 400, "message": "Validation failed", "errors": [{ "field": "ruc", "message": "Invalid RUC" }] }
 */
interface OlvaErrorBody {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: { code?: string } | null;
  errors?: OlvaFieldError[];
  retryAfter?: number;
}

export interface OlvaFieldError {
  field: string;
  message: string;
}

export const OLVA_FALLBACK_ERROR_MESSAGE = "Ocurrió un error. Intenta de nuevo en unos momentos.";

export const OLVA_RATE_LIMIT_ERROR_MESSAGE =
  "Alcanzaste el límite de consultas con Olva. Intenta de nuevo en unos minutos.";

export const OLVA_UNAVAILABLE_ERROR_MESSAGE =
  "Olva no está disponible en este momento. Intenta de nuevo en unos minutos.";

export const OLVA_PLAN_NOT_INCLUDED_ERROR_MESSAGE =
  "El servicio todavía no tiene habilitado el registro de envíos con Olva. Contacta a soporte.";

export const OLVA_OUTCOME_UNKNOWN_ERROR_MESSAGE =
  "No pudimos confirmar si Olva registró el envío. Revisa tu lista de envíos antes de intentarlo de nuevo.";

/** Messages for the codes every Olva call can fail with, whatever the domain. */
const GENERIC_MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  [OLVA_ERROR_CODES.PLAN_NOT_INCLUDED]: OLVA_PLAN_NOT_INCLUDED_ERROR_MESSAGE,
  [OLVA_ERROR_CODES.OUTCOME_UNKNOWN]: OLVA_OUTCOME_UNKNOWN_ERROR_MESSAGE,
  [OLVA_ERROR_CODES.RATE_LIMITED]: OLVA_RATE_LIMIT_ERROR_MESSAGE,
  // Credentials and upstream failures are the service's problem: nothing the user can fix
  [OLVA_ERROR_CODES.CREDENTIALS_REJECTED]: OLVA_UNAVAILABLE_ERROR_MESSAGE,
  [OLVA_ERROR_CODES.UPSTREAM_ERROR]: OLVA_UNAVAILABLE_ERROR_MESSAGE,
  [OLVA_ERROR_CODES.INTERNAL_ERROR]: OLVA_UNAVAILABLE_ERROR_MESSAGE,
  [OLVA_ERROR_CODES.NOT_IMPLEMENTED]: OLVA_UNAVAILABLE_ERROR_MESSAGE,
};

const NOT_FOUND_STATUS = 404;
const RATE_LIMIT_STATUS = 429;
const SERVER_ERROR_STATUSES: readonly number[] = [500, 501];

/** HTTP status of a failed request, if the backend answered at all (undefined on network errors). */
export function getOlvaErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/** Stable machine-readable code (`details.code`) of a failed request, if the backend sent one. */
export function getOlvaErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<OlvaErrorBody>(error)) {
    return error.response?.data?.details?.code;
  }

  return undefined;
}

/** Field-level validation errors (400), ready to feed `form.setError`. */
export function getOlvaFieldErrors(error: unknown): OlvaFieldError[] {
  if (axios.isAxiosError<OlvaErrorBody>(error)) {
    return error.response?.data?.errors ?? [];
  }

  return [];
}

export function isOlvaNotFoundError(error: unknown): boolean {
  return getOlvaErrorStatus(error) === NOT_FOUND_STATUS;
}

/** Seconds to wait before trying again after a rate limit (body `retryAfter`, else the header). */
export function getOlvaRetryAfterSeconds(error: unknown): number | undefined {
  if (!axios.isAxiosError<OlvaErrorBody>(error)) return undefined;

  const fromBody = error.response?.data?.retryAfter;

  if (typeof fromBody === "number" && fromBody > 0) return fromBody;

  const fromHeader = Number(error.response?.headers?.["retry-after"]);

  return Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : undefined;
}

function withRetryHint(message: string, seconds: number | undefined): string {
  if (seconds === undefined) return message;

  const wait =
    seconds < 60 ? `${Math.ceil(seconds)} segundos` : `${Math.ceil(seconds / 60)} minutos`;

  return `${message} Puedes reintentar en ${wait}.`;
}

/**
 * Turns any error thrown by the Olva services into a message ready to show the user (for
 * example via toast.error), so every call site uses the same wording.
 *
 * Order: a message the domain registered for the error code, the generic message of the Olva
 * codes, the first field error, a friendly message for rate limits and server failures, the
 * backend's own message, and a generic one.
 */
export function getOlvaErrorMessage(
  error: unknown,
  messagesByCode: Readonly<Record<string, string>> = {},
): string {
  if (!axios.isAxiosError<OlvaErrorBody>(error)) {
    return OLVA_FALLBACK_ERROR_MESSAGE;
  }

  const code = getOlvaErrorCode(error);

  if (code && code in messagesByCode) {
    return messagesByCode[code];
  }

  if (code && code in GENERIC_MESSAGES_BY_CODE) {
    const message = GENERIC_MESSAGES_BY_CODE[code];

    return code === OLVA_ERROR_CODES.RATE_LIMITED
      ? withRetryHint(message, getOlvaRetryAfterSeconds(error))
      : message;
  }

  const [firstFieldError] = getOlvaFieldErrors(error);

  if (firstFieldError) {
    return firstFieldError.message;
  }

  const status = getOlvaErrorStatus(error);

  if (status === RATE_LIMIT_STATUS) {
    return withRetryHint(OLVA_RATE_LIMIT_ERROR_MESSAGE, getOlvaRetryAfterSeconds(error));
  }

  if (status !== undefined && SERVER_ERROR_STATUSES.includes(status)) {
    return OLVA_UNAVAILABLE_ERROR_MESSAGE;
  }

  // Business errors from the backend are already human readable
  const backendMessage = error.response?.data?.error;

  if (typeof backendMessage === "string" && backendMessage.length > 0) {
    return backendMessage;
  }

  return OLVA_FALLBACK_ERROR_MESSAGE;
}
