import z from "zod";

export const PAYOUT_METHOD_OPTIONS: { value: "yape" | "plin" | "transferencia"; label: string }[] = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
];

export const updatePayoutSettingsSchema = z.object({
  method: z.enum(["yape", "plin", "transferencia"], {
    error: "Selecciona un método",
  }),

  accountNumber: z
    .string({ error: "El número o cuenta es obligatorio" })
    .trim()
    .min(1, "El número o cuenta es obligatorio"),
});

export type UpdatePayoutSettingsFormValues = z.infer<typeof updatePayoutSettingsSchema>;
