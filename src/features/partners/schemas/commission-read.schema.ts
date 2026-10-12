import z from "zod";
import type {
  CommissionCalculationItem,
  CommissionEvaluation,
  CommissionEvaluationsPage,
  CommissionItemsPage,
} from "../models/commission-read";

const uuid = z.uuid().refine((value) => value === value.toLowerCase());
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
});
export const commissionMoneySchema = z.string().regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,8})?$/);
export const commissionNetMoneySchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d{0,19})(?:\.\d{1,8})?$/)
  .refine((value) => !/^-0(?:\.0+)?$/.test(value));
export const commissionRateSchema = z.string().regex(/^(?:0(?:\.\d{1,10})?|1(?:\.0{1,10})?)$/);
const residualRate = commissionRateSchema.refine((value) => {
  const [whole, fraction = ""] = value.split(".");
  return whole === "0" && fraction.padEnd(10, "0") <= "0200000000";
});
export const commissionCursorSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);
export const commissionPageParamsSchema = z
  .object({
    cursor: commissionCursorSchema.nullable().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const commissionCalculationItemSchema = z
  .object({
    id: uuid,
    observationId: uuid,
    paymentId: uuid,
    subscriptionId: uuid,
    companyId: uuid,
    attributionId: uuid,
    partnerId: uuid,
    businessName: z.string().max(1000).nullable(),
    planName: z.string().max(1000).nullable(),
    currency: z.literal("PEN"),
    kind: z.enum(["FIRST", "RECURRING", "ANNUAL"]),
    initialBase: commissionMoneySchema.nullable(),
    recurringBase: commissionMoneySchema.nullable(),
    firstRate: commissionRateSchema,
    recurringRate: commissionRateSchema,
    residualRate,
    grossAmount: commissionMoneySchema,
    partnerFundedAmount: commissionMoneySchema,
    netAmount: commissionNetMoneySchema,
    approvalId: uuid,
    createdAt: utcInstant,
  })
  .strict() satisfies z.ZodType<CommissionCalculationItem>;

export const commissionEvaluationSchema = z
  .object({
    observationId: uuid,
    companyId: uuid.nullable(),
    attributionId: uuid.nullable(),
    state: z.enum(["BLOCKED", "GENERATED", "CONFLICT"]),
    // Only machine codes are accepted. The UI translates a fixed safe allowlist, never raw provider text.
    reasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/)).max(32),
    itemId: uuid.nullable(),
    firstCheckedAt: utcInstant,
    checkedAt: utcInstant,
  })
  .strict()
  .refine(
    (value) => value.state !== "GENERATED" || (value.itemId !== null && value.reasons.length === 0),
    "A generated evaluation requires its recorded item and no blocking reasons.",
  ) satisfies z.ZodType<CommissionEvaluation>;

export const commissionItemsPageSchema = z
  .object({
    items: z.array(commissionCalculationItemSchema).max(100),
    nextCursor: commissionCursorSchema.nullable(),
    hasMore: z.boolean(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine(
    (page) =>
      page.items.length <= page.limit &&
      page.hasMore === (page.nextCursor !== null) &&
      (!page.hasMore || page.items.length === page.limit) &&
      new Set(page.items.map((item) => item.id)).size === page.items.length,
    "A bounded page requires consistent cursor metadata and unique items.",
  ) satisfies z.ZodType<CommissionItemsPage>;
export const commissionEvaluationsPageSchema = z
  .object({
    items: z.array(commissionEvaluationSchema).max(100),
    nextCursor: commissionCursorSchema.nullable(),
    hasMore: z.boolean(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine(
    (page) =>
      page.items.length <= page.limit &&
      page.hasMore === (page.nextCursor !== null) &&
      (!page.hasMore || page.items.length === page.limit) &&
      new Set(page.items.map((item) => item.observationId)).size === page.items.length,
    "A bounded page requires consistent cursor metadata and unique evaluations.",
  ) satisfies z.ZodType<CommissionEvaluationsPage>;
