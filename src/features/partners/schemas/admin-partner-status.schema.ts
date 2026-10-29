import z from "zod";

const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
function noControlCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || (code >= 127 && code <= 159)) return false;
  }
  return true;
}
export const adminPartnerStatusOperationSchema = z.enum(["suspend", "resume"]);
export const adminPartnerStatusCommandSchema = z
  .object({
    expectedVersion: version,
    reason: z
      .string()
      .min(1)
      .max(2000)
      .refine(noControlCharacters, "El motivo no puede incluir caracteres de control.")
      .transform((value) => value.trim())
      .pipe(z.string().min(1)),
  })
  .strict();
export const adminPartnerStatusResultSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    version,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type AdminPartnerStatusOperation = z.infer<typeof adminPartnerStatusOperationSchema>;
export type AdminPartnerStatusCommand = z.infer<typeof adminPartnerStatusCommandSchema>;
export type AdminPartnerStatusResult = z.infer<typeof adminPartnerStatusResultSchema>;
