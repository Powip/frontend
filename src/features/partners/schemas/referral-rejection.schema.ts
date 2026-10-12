import z from "zod";

const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
function noControlCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || (code >= 127 && code <= 159)) return false;
  }
  return true;
}
export const referralRejectionCommandSchema = z
  .object({
    expectedVersion: version,
    reason: z
      .string()
      .min(1)
      .max(1000)
      .refine(noControlCharacters)
      .transform((value) => value.trim())
      .pipe(z.string().min(1)),
  })
  .strict();
export const referralRejectionResultSchema = z
  .object({
    id: z.uuid(),
    partnerId: z.uuid(),
    origin: z.enum(["MANUAL", "CODE"]),
    state: z.literal("CANCELLED"),
    decision: z.literal("REJECTED"),
    version,
    decidedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type ReferralRejectionCommand = z.infer<typeof referralRejectionCommandSchema>;
export type ReferralRejectionResult = z.infer<typeof referralRejectionResultSchema>;
