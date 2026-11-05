import { z } from "zod";
import {
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

export const createOlvaSenderProfileSchema = z.object({
  label: labelSchema,
  ruc: z
    .string({ error: "El RUC es obligatorio" })
    .trim()
    .min(1, "El RUC es obligatorio")
    .refine((value) => value === "" || isValidOlvaRuc(value), { error: "El RUC no es válido" }),
  email: emailSchema,
  firstNames: firstNamesSchema,
  lastName: lastNameSchema,
  phone: optionalPhoneSchema,
  isDefault: z.boolean(),
});

// No `ruc`: it cannot be changed, another RUC is another profile
export const updateOlvaSenderProfileSchema = z.object({
  label: labelSchema,
  email: emailSchema,
  firstNames: firstNamesSchema,
  lastName: lastNameSchema,
  phone: optionalPhoneSchema,
});

export type CreateOlvaSenderProfileFormValues = z.infer<typeof createOlvaSenderProfileSchema>;
export type UpdateOlvaSenderProfileFormValues = z.infer<typeof updateOlvaSenderProfileSchema>;
