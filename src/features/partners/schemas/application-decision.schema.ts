import z from "zod";

export const applicationDecisionSchema = z.object({
  reason: z.string({ error: "El motivo es obligatorio" }).trim().min(1, "El motivo es obligatorio"),
});

export type ApplicationDecisionFormValues = z.infer<typeof applicationDecisionSchema>;
