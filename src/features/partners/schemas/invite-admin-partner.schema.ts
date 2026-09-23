import z from "zod";

export const PARTNER_PROFILE_OPTIONS: { value: "agencia" | "dev" | "creador"; label: string }[] = [
  { value: "agencia", label: "🏢 Agencia" },
  { value: "dev", label: "👨‍💻 Dev" },
  { value: "creador", label: "🎬 Creador" },
];

export const inviteAdminPartnerSchema = z.object({
  name: z
    .string({ error: "El nombre o marca es obligatorio" })
    .trim()
    .min(1, "El nombre o marca es obligatorio"),

  email: z
    .string({ error: "El correo es obligatorio" })
    .trim()
    .min(1, "El correo es obligatorio")
    .email("Ingresa un correo válido"),

  profile: z.enum(["agencia", "dev", "creador"], {
    error: "Selecciona un perfil",
  }),

  suggestedOptionCode: z.enum(["A", "B", "C"], {
    error: "Selecciona una opción sugerida",
  }),
});

export type InviteAdminPartnerFormValues = z.infer<typeof inviteAdminPartnerSchema>;
