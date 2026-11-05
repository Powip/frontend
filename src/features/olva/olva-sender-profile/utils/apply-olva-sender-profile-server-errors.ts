import type { FieldPath } from "react-hook-form";
import {
  type CreateOlvaSenderProfileFormValues,
  createOlvaSenderProfileSchema,
} from "../schemas/olva-sender-profile.schema";
import {
  getOlvaSenderProfileErrorCode,
  getOlvaSenderProfileErrorMessage,
  getOlvaSenderProfileFieldErrors,
  OLVA_SENDER_PROFILE_ERROR_CODES,
  type OlvaSenderProfileErrorCode,
} from "./olva-sender-profile-error.util";

type CreateField = FieldPath<CreateOlvaSenderProfileFormValues>;

/** Same signature as react-hook-form's `form.setError`, so the util needs no form instance. */
export type SetFieldError = (name: CreateField, error: { type: string; message: string }) => void;

const CREATE_FIELDS = new Set<string>(Object.keys(createOlvaSenderProfileSchema.shape));

/** Business error codes that are caused by one specific input. */
const FIELD_BY_CODE: Partial<Record<OlvaSenderProfileErrorCode, CreateField>> = {
  [OLVA_SENDER_PROFILE_ERROR_CODES.INVALID_RUC]: "ruc",
  [OLVA_SENDER_PROFILE_ERROR_CODES.DUPLICATE_RUC]: "ruc",
  [OLVA_SENDER_PROFILE_ERROR_CODES.RUC_NOT_FOUND_IN_OLVA]: "ruc",
  [OLVA_SENDER_PROFILE_ERROR_CODES.RUC_NOT_ACTIVE]: "ruc",
};

function isCreateField(field: string): field is CreateField {
  return CREATE_FIELDS.has(field);
}

/**
 * Pins a failed create request to the inputs that caused it, so the user sees the problem next
 * to the field instead of only in a toast. Errors that do not belong to a field (limit reached,
 * network, ...) are left to the mutation's toast.
 *
 * @returns true when at least one field error was set.
 */
export function applyOlvaSenderProfileServerErrors(
  setError: SetFieldError,
  error: unknown,
): boolean {
  let applied = false;

  const code = getOlvaSenderProfileErrorCode(error);
  const fieldForCode = code ? FIELD_BY_CODE[code] : undefined;

  if (fieldForCode) {
    setError(fieldForCode, {
      type: "server",
      message: getOlvaSenderProfileErrorMessage(error),
    });
    applied = true;
  }

  for (const { field, message } of getOlvaSenderProfileFieldErrors(error)) {
    if (!isCreateField(field)) continue;

    setError(field, { type: "server", message });
    applied = true;
  }

  return applied;
}
