import z from "zod";
import { normalizePhone } from "../mappers/to-submit-partner-application-request-dto";

export const PARTNER_APPLICATION_FIELDS = [
  "email",
  "legalName",
  "contactName",
  "phone",
  "country",
] as const;

const PHONE_CHARACTERS = /^\+?[\d\s()-]+$/;
const COUNTRY_CODE = /^[A-Za-z]{2}$/;

export const submitPartnerApplicationSchema = z.object({
  email: z
    .string({ error: "El correo es obligatorio" })
    .trim()
    .min(1, "El correo es obligatorio")
    .max(320, "El correo debe tener como máximo 320 caracteres")
    .email("Ingresá un correo válido"),

  legalName: z
    .string({ error: "La razón social es obligatoria" })
    .trim()
    .min(1, "La razón social es obligatoria")
    .min(2, "La razón social debe tener al menos 2 caracteres")
    .max(160, "La razón social debe tener como máximo 160 caracteres"),

  contactName: z
    .string({ error: "El nombre de contacto es obligatorio" })
    .trim()
    .min(1, "El nombre de contacto es obligatorio")
    .min(2, "El nombre de contacto debe tener al menos 2 caracteres")
    .max(160, "El nombre de contacto debe tener como máximo 160 caracteres"),

  phone: z
    .string({ error: "El teléfono es obligatorio" })
    .trim()
    .min(1, "El teléfono es obligatorio")
    .regex(PHONE_CHARACTERS, "Usá solo números, espacios, guiones, paréntesis y un + inicial")
    .refine((phone) => {
      const length = normalizePhone(phone).length;
      return length >= 7 && length <= 30;
    }, "El teléfono debe tener entre 7 y 30 caracteres sin espacios, guiones ni paréntesis"),

  country: z
    .string({ error: "El país es obligatorio" })
    .trim()
    .min(1, "El país es obligatorio")
    .regex(COUNTRY_CODE, "Ingresá el código de país de dos letras, por ejemplo PE"),
});

export type SubmitPartnerApplicationFormValues = z.infer<typeof submitPartnerApplicationSchema>;
