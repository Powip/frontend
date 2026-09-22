import z from "zod";
import { PARTNER_PLAN_OPTIONS } from "../models/plan-option";

const PLAN_VALUES = PARTNER_PLAN_OPTIONS.map((option) => option.value) as [string, ...string[]];

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

  planValue: z.enum(PLAN_VALUES, {
    error: "Selecciona un plan",
  }),
});

export type RegisterReferralFormValues = z.infer<typeof registerReferralSchema>;
