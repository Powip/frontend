import z from "zod";

export const PAYOUT_METHOD_OPTIONS: { value: "yape" | "plin" | "transferencia"; label: string }[] =
  [
    { value: "yape", label: "Yape" },
    { value: "plin", label: "Plin" },
    { value: "transferencia", label: "Transferencia" },
  ];

const boundedText = (maximum: number, required: string) =>
  z
    .string({ error: required })
    .max(maximum, `Máximo ${maximum} caracteres`)
    .refine(
      (value) =>
        Array.from(value).every((character) => {
          const point = character.codePointAt(0) ?? 0;
          return point >= 32 && point !== 127 && !(point >= 128 && point <= 159);
        }),
      "No se permiten caracteres de control",
    )
    .transform((value) => value.trim())
    .pipe(z.string().min(1, required));

export const updatePayoutSettingsSchema = z
  .object({
    method: z.enum(["yape", "plin", "transferencia"], {
      error: "Selecciona un método",
    }),

    accountNumber: boundedText(128, "El número o cuenta es obligatorio"),
    accountHolder: boundedText(160, "El titular es obligatorio"),
    reason: boundedText(1000, "El motivo es obligatorio"),
  })
  .strict();

export const payoutSettingsCommandSchema = updatePayoutSettingsSchema
  .extend({
    expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .strict();

export const payoutSettingsResponseSchema = z
  .object({
    settings: z
      .object({
        method: z.enum(["yape", "plin", "transferencia"]),
        accountNumber: z.string().min(1).max(128),
        accountHolder: z.string().min(1).max(160),
        version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        updatedAt: z.iso.datetime({ offset: true }),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type PayoutSettingsCommand = z.infer<typeof payoutSettingsCommandSchema>;

export type UpdatePayoutSettingsFormValues = z.infer<typeof updatePayoutSettingsSchema>;
