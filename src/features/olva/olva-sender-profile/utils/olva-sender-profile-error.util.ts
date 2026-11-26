import {
  getOlvaErrorCode,
  getOlvaErrorMessage,
  getOlvaFieldErrors,
} from "@/features/olva/shared/utils/olva-error.util";

// Generic handling (body shapes, 429/5xx, field errors) lives in shared/utils/olva-error.util.ts.
// Codes mirror domain/sender-profiles/sender-profile.errors.ts on the backend.

export const OLVA_SENDER_PROFILE_ERROR_CODES = {
  INVALID_RUC: "SENDER_PROFILE_INVALID_RUC",
  NOT_CONFIGURED: "SENDER_PROFILE_NOT_CONFIGURED",
  ARCHIVED: "SENDER_PROFILE_ARCHIVED",
  RUC_NOT_FOUND_IN_OLVA: "SENDER_PROFILE_RUC_NOT_FOUND_IN_OLVA",
  RUC_NOT_ACTIVE: "SENDER_PROFILE_RUC_NOT_ACTIVE",
  DUPLICATE_RUC: "SENDER_PROFILE_DUPLICATE_RUC",
  LIMIT_REACHED: "SENDER_PROFILE_LIMIT_REACHED",
  CANNOT_ARCHIVE_DEFAULT: "SENDER_PROFILE_CANNOT_ARCHIVE_DEFAULT",
  NAMES_REQUIRED: "SENDER_PROFILE_NAMES_REQUIRED",
} as const;

export type OlvaSenderProfileErrorCode =
  (typeof OLVA_SENDER_PROFILE_ERROR_CODES)[keyof typeof OLVA_SENDER_PROFILE_ERROR_CODES];

const MESSAGES_BY_CODE: Record<string, string> = {
  [OLVA_SENDER_PROFILE_ERROR_CODES.INVALID_RUC]: "El RUC ingresado no es válido.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.NOT_CONFIGURED]:
    "Todavía no tienes un remitente configurado. Crea uno para poder enviar con Olva.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.ARCHIVED]:
    "Este remitente fue archivado. Refresca la página e intenta nuevamente.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.RUC_NOT_FOUND_IN_OLVA]:
    "Olva no encontró ese RUC. Verifica el número e intenta nuevamente.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.RUC_NOT_ACTIVE]:
    "El RUC no está activo, por lo que Olva no lo acepta como remitente.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.DUPLICATE_RUC]: "Ya tienes un remitente registrado con ese RUC.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.LIMIT_REACHED]:
    "Alcanzaste el máximo de remitentes activos. Archiva uno para crear otro.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.CANNOT_ARCHIVE_DEFAULT]:
    "No puedes archivar el remitente predeterminado. Elige otro como predeterminado primero.",
  [OLVA_SENDER_PROFILE_ERROR_CODES.NAMES_REQUIRED]:
    "Este remitente necesita nombres y apellido para registrar envíos. Complétalos e intenta de nuevo.",
};

/** Stable machine-readable code (`details.code`) of a failed request, if the backend sent one. */
export function getOlvaSenderProfileErrorCode(
  error: unknown,
): OlvaSenderProfileErrorCode | undefined {
  return getOlvaErrorCode(error) as OlvaSenderProfileErrorCode | undefined;
}

/** Field-level validation errors (400), ready to feed `form.setError`. */
export function getOlvaSenderProfileFieldErrors(
  error: unknown,
): { field: string; message: string }[] {
  return getOlvaFieldErrors(error);
}

/**
 * Turns any error thrown by the olva-sender-profile services into a message ready to show the
 * user (e.g. via toast.error), so every call site uses the same wording.
 */
export function getOlvaSenderProfileErrorMessage(error: unknown): string {
  return getOlvaErrorMessage(error, MESSAGES_BY_CODE);
}
