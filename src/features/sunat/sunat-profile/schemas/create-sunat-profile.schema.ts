import { z } from "zod";
import { COUNTRY_CODES } from "../../shared/enums/sunat.enums";

export const createSunatProfileSchema = z.object({
  name: z
    .string({
      error: "Name is required",
    })
    .min(3, "Name must have at least 3 characters")
    .max(100, "Name must have at most 100 characters"),

  description: z.string().optional(),

  ruc: z.string({
    error: "RUC is required",
  }),

  razonSocial: z.string({
    error: "Razon social is required",
  }),

  countryCode: z.enum(COUNTRY_CODES, {
    error: "Country code is required",
  }),

  ubigeo: z.string({
    error: "Ubigeo is required",
  }),

  address: z.string({
    error: "Address is required",
  }),

  establishmentCode: z.string({
    error: "Establishment code is required",
  }),

  solUser: z.string({
    error: "SOL user is required",
  }),

  solPassword: z.string({
    error: "SOL password is required",
  }),

  certificatePassword: z.string({
    error: "Certificate password is required",
  }),

  certificate: z.instanceof(File, {
    error: "Certificate is required",
  }),

  logo: z
    .instanceof(File, {
      error: "Logo is required",
    })
    .optional(),
});

export type CreateSunatProfileFormValues = z.infer<typeof createSunatProfileSchema>;
