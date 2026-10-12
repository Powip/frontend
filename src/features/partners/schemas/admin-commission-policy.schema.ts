import z from "zod";

// Decimal strings remain exact: no floating-point conversion or percentage defaults.
export const commissionPolicyRateSchema = z
  .string()
  .regex(/^(?:0(?:\.\d{1,10})?|1(?:\.0{1,10})?)$/);
const instant = z.iso.datetime({ offset: true });
const code = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const count = z.number().int().min(1).max(2_147_483_647).nullable();

export const adminCommissionPolicyDraftCommandSchema = z
  .object({
    code,
    currency,
    firstPaymentRate: commissionPolicyRateSchema,
    recurringPaymentRate: commissionPolicyRateSchema,
    recurringPaymentCount: count,
    effectiveFrom: instant.nullable(),
    reason: z
      .string()
      .max(2000)
      .refine((value) => value.trim().length > 0 && !value.includes("\0")),
  })
  .strict();

export const adminCommissionPolicyVersionSchema = z
  .object({
    id: z.uuid(),
    code,
    state: z.literal("DRAFT"),
    currency,
    firstPaymentRate: commissionPolicyRateSchema,
    recurringPaymentRate: commissionPolicyRateSchema,
    recurringPaymentCount: count,
    effectiveFrom: instant.nullable(),
    createdAt: instant,
  })
  .strict();

export const adminCommissionPolicyPageSchema = z
  .object({
    items: z.array(adminCommissionPolicyVersionSchema).max(100),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();
