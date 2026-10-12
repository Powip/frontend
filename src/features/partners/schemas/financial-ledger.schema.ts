import z from "zod";
import type {
  FinancialLedgerBalance,
  FinancialLedgerEntry,
  FinancialLedgerPage,
} from "../models/financial-ledger";
import { commissionCursorSchema } from "./commission-read.schema";

export const financialLedgerPartnerIdSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase());
const uuid = financialLedgerPartnerIdSchema;
const instant = z.iso.datetime().refine((value) => {
  const date = new Date(value);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
  return Boolean(
    parts &&
      value.endsWith("Z") &&
      Number.isFinite(date.getTime()) &&
      date.getUTCFullYear() === Number(parts[1]) &&
      date.getUTCMonth() + 1 === Number(parts[2]) &&
      date.getUTCDate() === Number(parts[3]),
  );
});
const zero = (value: string) => /^-?0(?:\.0+)?$/.test(value);
const signed = (digits: number) =>
  z
    .string()
    .regex(new RegExp(`^-?(?:0|[1-9]\\d{0,${digits - 1}})(?:\\.\\d{1,8})?$`))
    .refine((value) => !(value.startsWith("-") && zero(value)), "Negative zero is not canonical.");

export const financialLedgerEntrySchema = z
  .object({
    id: uuid,
    postingId: uuid,
    calculationItemId: uuid,
    partnerId: uuid,
    observationId: uuid,
    companyId: uuid,
    paymentId: uuid,
    subscriptionId: uuid,
    sourceItemKind: z.enum(["FIRST", "RECURRING", "ANNUAL"]),
    currency: z.literal("PEN"),
    kind: z.enum(["GROSS_COMMISSION", "PARTNER_FUNDED_DISCOUNT"]),
    signedAmount: signed(20),
    postedAt: instant,
  })
  .strict()
  .refine(
    (item) =>
      item.kind === "GROSS_COMMISSION"
        ? !item.signedAmount.startsWith("-")
        : item.signedAmount.startsWith("-") && !zero(item.signedAmount),
    "The entry sign must match its recorded component.",
  ) satisfies z.ZodType<FinancialLedgerEntry>;

export const financialLedgerPageSchema = z
  .object({
    items: z.array(financialLedgerEntrySchema).max(100),
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
    "Ledger pagination must be bounded and consistent.",
  ) satisfies z.ZodType<FinancialLedgerPage>;

export const financialLedgerBalanceSchema = z
  .object({
    partnerId: uuid,
    currency: z.literal("PEN"),
    // Aggregate balance is not limited to one item's amount. Never convert it to a JS number.
    postedLedgerBalance: signed(80),
    postedEntryCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    availability: z.enum(["NO_POSTED_ENTRIES", "POSTED_ENTRIES"]),
    settlementEligibility: z.literal("NOT_EVALUATED"),
    asOf: instant,
  })
  .strict()
  .refine(
    (balance) =>
      balance.postedEntryCount === 0
        ? balance.availability === "NO_POSTED_ENTRIES" && zero(balance.postedLedgerBalance)
        : balance.availability === "POSTED_ENTRIES",
    "Availability must describe actual posted entries, never inferred payout eligibility.",
  ) satisfies z.ZodType<FinancialLedgerBalance>;
