import z from "zod";

export const billingEvidenceStateSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "RETRY",
  "PROCESSED",
  "QUARANTINED",
  "FAILED",
]);
const instant = z.iso.datetime({ offset: true });
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const missingField = z.enum([
  "amount",
  "currency",
  "paidAt",
  "priceList",
  "netPaid",
  "discount",
  "commissionPeriod",
  "verifiedCharge",
  "periodStart",
  "periodEnd",
  "monetaryProvenance",
  "PRECISION_UNVERIFIED",
  "AMOUNT_PRECISION_UNSUPPORTED",
]);
const reconciliationReason = z.enum([
  "BILLING_PROCESSING_PENDING",
  "BILLING_PROCESSING_PROCESSING",
  "BILLING_PROCESSING_RETRY",
  "BILLING_PROCESSING_FAILED",
  "OBSERVATION_NOT_AVAILABLE",
  "EVIDENCE_QUARANTINED",
  "ACTUAL_PAID_AMOUNT_NOT_PROVEN",
  "ACTUAL_PAID_CURRENCY_NOT_PROVEN",
  "PAID_AT_NOT_PROVEN",
  "FINANCIAL_SNAPSHOT_NOT_CLASSIFIABLE",
  "UNCLASSIFIED_MISSING_FINANCIAL_FIELDS",
  "COMPANY_NOT_OBSERVED",
  "MULTIPLE_COMPANY_CANDIDATES",
  "ATTRIBUTION_NOT_RESOLVED",
  "BINDING_QUARANTINED",
  "PROVIDER_CHARGE_NOT_VERIFIED",
  "FINANCIAL_SNAPSHOT_INCOMPLETE",
  "FINANCIAL_POLICY_NOT_ACTIVE",
  "FINANCIAL_EVIDENCE_QUARANTINED",
  "FINANCIAL_STATE_NOT_CLASSIFIABLE",
  "BINDING_NOT_AVAILABLE",
]);
const binding = z
  .object({
    state: z.enum([
      "WAITING_COMPANY",
      "AMBIGUOUS_COMPANY",
      "WAITING_ATTRIBUTION",
      "LINKED",
      "QUARANTINED",
    ]),
    financeState: z.enum(["UNVERIFIED", "INCOMPLETE", "PENDING_POLICY", "QUARANTINED"]),
    companyId: z.uuid().nullable(),
    attributionId: z.uuid().nullable(),
    candidateCount: count,
    checkedAt: instant.nullable(),
    nextCheckAt: instant,
  })
  .strict()
  .refine(
    (value) =>
      value.state === "LINKED"
        ? value.companyId !== null && value.attributionId !== null && value.candidateCount === 1
        : value.attributionId === null,
    { message: "Stored binding references disagree" },
  );

export const adminBillingEvidenceSchema = z
  .object({
    id: z.uuid(),
    eventId: z.uuid(),
    eventType: z.enum(["billing.payment-confirmed", "billing.invoice-paid-observed"]),
    occurredAt: instant,
    receivedAt: instant,
    state: billingEvidenceStateSchema,
    attempts: z.number().int().min(0).max(20),
    availableAt: instant,
    processedAt: instant.nullable(),
    lastErrorCode: z
      .enum([
        "LEASE_EXPIRED",
        "PROCESSING_FAILED",
        "EVENT_ID_CONFLICT",
        "ECONOMIC_FACT_CONFLICT",
        "PROVIDER_PAYMENT_ID_CONFLICT",
      ])
      .nullable(),
    paymentId: z.uuid(),
    subscriptionId: z.uuid(),
    provider: z.literal("FLOW"),
    invoiceId: z.string().min(1).max(128),
    factType: z.enum(["CHARGE_CONFIRMED", "INVOICE_PAID_OBSERVED"]),
    observationId: z.uuid().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    // Exact decimal text, never coerced to JS Number or reformatted as a rounded amount.
    amount: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,19})(?:\.\d{1,8})?$/)
      .nullable(),
    paidAt: instant.nullable(),
    binding: binding.nullable(),
    conflictCount: count,
    conflictReasons: z.array(
      z.enum(["EVENT_ID_CONFLICT", "ECONOMIC_FACT_CONFLICT", "PROVIDER_PAYMENT_ID_CONFLICT"]),
    ),
    missingFields: z.array(missingField),
    reconciliationReasons: z.array(reconciliationReason),
  })
  .strict()
  .refine(
    (item) =>
      (item.factType === "CHARGE_CONFIRMED") === (item.eventType === "billing.payment-confirmed"),
    { message: "Event and economic fact disagree" },
  )
  .refine(
    (item) =>
      item.observationId !== null ||
      (item.amount === null &&
        item.currency === null &&
        item.paidAt === null &&
        item.binding === null),
    { message: "Evidence without an observation cannot carry financial or binding values" },
  );

export const adminBillingEvidencePageSchema = z
  .object({
    items: z.array(adminBillingEvidenceSchema),
    nextCursor: z.string().min(1).max(512).nullable(),
    hasMore: z.boolean(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine((page) => page.hasMore === (page.nextCursor !== null), {
    message: "Cursor and pagination state disagree",
  })
  .refine((page) => page.items.length <= page.limit, { message: "Page exceeds its limit" });

export type BillingEvidenceState = z.infer<typeof billingEvidenceStateSchema>;
export type AdminBillingEvidence = z.infer<typeof adminBillingEvidenceSchema>;
export type AdminBillingEvidencePage = z.infer<typeof adminBillingEvidencePageSchema>;
