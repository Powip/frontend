import z from "zod";

export const registerReferralSchema = z.object({
  businessName: z
    .string({ error: "El nombre del negocio es obligatorio" })
    .trim()
    .min(1, "El nombre del negocio es obligatorio"),

  email: z
    .string({ error: "El correo es obligatorio" })
    .trim()
    .min(1, "El correo es obligatorio")
    .email("Ingresa un correo válido"),

  phone: z.string().trim().optional(),
});

export type RegisterReferralFormValues = z.infer<typeof registerReferralSchema>;
