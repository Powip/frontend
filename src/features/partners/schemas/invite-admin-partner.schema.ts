import z from "zod";

export const PARTNER_PROFILE_OPTIONS: { value: "agencia" | "dev" | "creador"; label: string }[] = [
  { value: "agencia", label: "🏢 Agencia" },
  { value: "dev", label: "👨‍💻 Dev" },
  { value: "creador", label: "🎬 Creador" },
];

export const inviteAdminPartnerSchema = z
  .object({
    name: z
      .string({ error: "El nombre o marca es obligatorio" })
      .trim()
      .min(1, "El nombre o marca es obligatorio")
      .max(160)
      .refine(
        (value) => !/[\u0000-\u001f\u007f-\u009f]/.test(value),
        "No se permiten caracteres de control",
      ),

    email: z
      .string({ error: "El correo es obligatorio" })
      .trim()
      .min(1, "El correo es obligatorio")
      .max(320)
      .email("Ingresa un correo válido"),

    profile: z.enum(["agencia", "dev", "creador"], {
      error: "Selecciona un perfil",
    }),
  })
  .strict();

export type InviteAdminPartnerFormValues = z.infer<typeof inviteAdminPartnerSchema>;
