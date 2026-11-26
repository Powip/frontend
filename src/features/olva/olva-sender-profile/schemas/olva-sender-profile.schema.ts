import { z } from "zod";
import {
  OLVA_DNI_LENGTH,
  OLVA_SENDER_DOCUMENT_TYPES,
  OLVA_SENDER_EMAIL_MAX_LENGTH,
  OLVA_SENDER_LABEL_MAX_LENGTH,
  OLVA_SENDER_NAME_MAX_LENGTH,
  OLVA_SENDER_PHONE_MAX_LENGTH,
  OLVA_SENDER_PHONE_MIN_LENGTH,
} from "../constants/olva-sender-profile.constants";
import { isValidOlvaRuc } from "../utils/is-valid-olva-ruc";

// Same rules as the backend DTO schemas (create-sender-profile-request.dto.ts).
// Messages are user-facing, so they are in Spanish like the rest of the UI.
const labelSchema = z
  .string({ error: "El nombre del remitente es obligatorio" })
  .trim()
  .min(1, "El nombre del remitente es obligatorio")
  .max(
    OLVA_SENDER_LABEL_MAX_LENGTH,
    `El nombre del remitente no puede superar los ${OLVA_SENDER_LABEL_MAX_LENGTH} caracteres`,
  );

const emailSchema = z
  .string({ error: "El correo es obligatorio" })
  .trim()
  .min(1, "El correo es obligatorio")
  .max(
    OLVA_SENDER_EMAIL_MAX_LENGTH,
    `El correo no puede superar los ${OLVA_SENDER_EMAIL_MAX_LENGTH} caracteres`,
  )
  .pipe(z.email({ error: "El formato del correo no es válido" }));

const firstNamesSchema = z
  .string({ error: "Los nombres son obligatorios" })
  .trim()
  .min(1, "Los nombres son obligatorios")
  .max(
    OLVA_SENDER_NAME_MAX_LENGTH,
    `Los nombres no pueden superar los ${OLVA_SENDER_NAME_MAX_LENGTH} caracteres`,
  );

const lastNameSchema = z
  .string({ error: "El apellido es obligatorio" })
  .trim()
  .min(1, "El apellido es obligatorio")
  .max(
    OLVA_SENDER_NAME_MAX_LENGTH,
    `El apellido no puede superar los ${OLVA_SENDER_NAME_MAX_LENGTH} caracteres`,
  );

// An empty input means "no phone"; anything else must look like a phone
const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || value.length >= OLVA_SENDER_PHONE_MIN_LENGTH, {
    error: `El teléfono debe tener al menos ${OLVA_SENDER_PHONE_MIN_LENGTH} caracteres`,
  })
  .refine((value) => value.length <= OLVA_SENDER_PHONE_MAX_LENGTH, {
    error: `El teléfono no puede superar los ${OLVA_SENDER_PHONE_MAX_LENGTH} caracteres`,
  })
  .refine((value) => value === "" || /^[0-9+()\-\s]+$/.test(value), {
    error: "El teléfono solo admite dígitos, espacios y + ( ) -",
  });

const DNI_PATTERN = new RegExp(`^\\d{${OLVA_DNI_LENGTH}}$`);

/** The message for a document number of that type, or null when it is fine. */
function documentNumberError(type: string, value: string): string | null {
  if (type === OLVA_SENDER_DOCUMENT_TYPES.DNI) {
    if (value === "") return "El DNI es obligatorio";
    return DNI_PATTERN.test(value) ? null : `El DNI debe tener ${OLVA_DNI_LENGTH} dígitos`;
  }
  if (type === OLVA_SENDER_DOCUMENT_TYPES.RUC) {
    if (value === "") return "El RUC es obligatorio";
    return isValidOlvaRuc(value) ? null : "El RUC no es válido";
  }
  return null;
}

// FEAT-35: a business ships by RUC, a person by DNI (same rules as the backend's SenderDocument)
export const createOlvaSenderProfileSchema = z
  .object({
    label: labelSchema,
    documentType: z.enum([OLVA_SENDER_DOCUMENT_TYPES.DNI, OLVA_SENDER_DOCUMENT_TYPES.RUC], {
      error: "Elige DNI o RUC",
    }),
    documentNumber: z.string().trim(),
    email: emailSchema,
    firstNames: firstNamesSchema,
    lastName: lastNameSchema,
    phone: optionalPhoneSchema,
    isDefault: z.boolean(),
  })
  // Runs even when other fields fail, so every input shows its message at once
  .superRefine((values, ctx) => {
    const message = documentNumberError(values.documentType, values.documentNumber);
    if (message) ctx.addIssue({ code: "custom", path: ["documentNumber"], message });
  });

// No document: it cannot be changed, another document is another profile
export const updateOlvaSenderProfileSchema = z.object({
  label: labelSchema,
  email: emailSchema,
  firstNames: firstNamesSchema,
  lastName: lastNameSchema,
  phone: optionalPhoneSchema,
});

export type CreateOlvaSenderProfileFormValues = z.infer<typeof createOlvaSenderProfileSchema>;
export type UpdateOlvaSenderProfileFormValues = z.infer<typeof updateOlvaSenderProfileSchema>;
