import z from "zod";

export const applicationDecisionSchema = z.object({
  reason: z
    .string({ error: "El motivo es obligatorio" })
    .trim()
    .min(1, "El motivo es obligatorio")
    .min(3, "El motivo debe tener al menos 3 caracteres")
    .max(500, "El motivo debe tener como máximo 500 caracteres"),
});

export type ApplicationDecisionFormValues = z.infer<typeof applicationDecisionSchema>;
