import z from "zod";

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
    .email("Ingresá un correo válido"),

  legalName: z
    .string({ error: "La razón social es obligatoria" })
    .trim()
    .min(1, "La razón social es obligatoria"),

  contactName: z
    .string({ error: "El nombre de contacto es obligatorio" })
    .trim()
    .min(1, "El nombre de contacto es obligatorio"),

  phone: z
    .string({ error: "El teléfono es obligatorio" })
    .trim()
    .min(1, "El teléfono es obligatorio")
    .regex(PHONE_CHARACTERS, "Usá solo números, espacios, guiones, paréntesis y un + inicial"),

  country: z
    .string({ error: "El país es obligatorio" })
    .trim()
    .min(1, "El país es obligatorio")
    .regex(COUNTRY_CODE, "Ingresá el código de país de dos letras, por ejemplo PE"),
});

export type SubmitPartnerApplicationFormValues = z.infer<typeof submitPartnerApplicationSchema>;
