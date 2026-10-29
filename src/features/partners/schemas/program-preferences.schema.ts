import z from "zod";
import type {
  ProgramPreferencesCommand,
  ProgramPreferencesResponse,
  ProgramPreferencesSettings,
} from "../models/program-preferences";

const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const utcInstant = z.iso.datetime().refine((value) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.exec(value);
  if (!parts) return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === Number(parts[1]) &&
    parsed.getUTCMonth() + 1 === Number(parts[2]) &&
    parsed.getUTCDate() === Number(parts[3])
  );
}, "La fecha debe ser un instante UTC válido.");

export const programPreferencesOptionCodeSchema = z.enum(["A", "B", "C"]);

// Preserve decimal strings, including historical values outside the UI's 0/5/10 selector.
export const programPreferencesDiscountPctSchema = z
  .string()
  .regex(/^(?:[0-9](?:\.\d{1,10})?|10(?:\.0{1,10})?)$/);

export const programPreferencesCommandSchema = z
  .object({
    optionCode: programPreferencesOptionCodeSchema,
    discountPct: programPreferencesDiscountPctSchema,
    expectedVersion: version.nullable(),
    reason: z
      .string()
      .max(1000)
      .refine(
        (value) =>
          Array.from(value).every((character) => {
            const point = character.codePointAt(0) ?? 0;
            return point >= 32 && point !== 127 && !(point >= 128 && point <= 159);
          }),
        "El motivo no puede incluir caracteres de control.",
      )
      .transform((value) => value.trim())
      .pipe(z.string().min(1, "El motivo es obligatorio.")),
  })
  .strict() satisfies z.ZodType<ProgramPreferencesCommand>;

export const programPreferencesSettingsSchema = z
  .object({
    optionCode: programPreferencesOptionCodeSchema,
    discountPct: programPreferencesDiscountPctSchema,
    version,
    updatedAt: utcInstant,
  })
  .strict() satisfies z.ZodType<ProgramPreferencesSettings>;

export const programPreferencesResponseSchema = z
  .object({
    settings: programPreferencesSettingsSchema.nullable(),
    effectiveTerms: z
      .object({
        status: z.literal("NOT_CONFIGURED"),
        policyVersion: z.null(),
        firstPaymentRate: z.null(),
        recurringPaymentRate: z.null(),
      })
      .strict(),
    catalog: z
      .object({
        source: z.literal("POWIP_PARTNERS_PROGRAM_SPEC"),
        version: z.literal("2.0"),
        date: z.literal("2026-08-17"),
        options: z.tuple([
          z
            .object({
              code: z.literal("A"),
              firstPaymentPct: z.literal("40"),
              recurringPaymentPct: z.literal("6"),
            })
            .strict(),
          z
            .object({
              code: z.literal("B"),
              firstPaymentPct: z.literal("70"),
              recurringPaymentPct: z.literal("3"),
            })
            .strict(),
          z
            .object({
              code: z.literal("C"),
              firstPaymentPct: z.literal("50"),
              recurringPaymentPct: z.literal("8"),
            })
            .strict(),
        ]),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<ProgramPreferencesResponse>;
