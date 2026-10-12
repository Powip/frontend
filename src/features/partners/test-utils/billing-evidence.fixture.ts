import type {
  AdminBillingEvidence,
  AdminBillingEvidencePage,
} from "../schemas/admin-billing-evidence.schema";

// Only test code imports this synthetic contract fixture. Production always requests the real API.
export const BILLING_USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const BILLING_USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const BILLING_ID = "11111111-1111-4111-8111-111111111111";
export function billingEvidence(
  overrides: Partial<AdminBillingEvidence> = {},
): AdminBillingEvidence {
  return {
    id: BILLING_ID,
    eventId: "22222222-2222-4222-8222-222222222222",
    eventType: "billing.payment-confirmed",
    occurredAt: "2026-10-11T12:00:00.123456Z",
    receivedAt: "2026-10-11T12:00:00.123456Z",
    state: "PROCESSED",
    attempts: 1,
    availableAt: "2026-10-11T12:00:00.123456Z",
    processedAt: "2026-10-11T12:01:00Z",
    lastErrorCode: null,
    paymentId: "33333333-3333-4333-8333-333333333333",
    subscriptionId: "44444444-4444-4444-8444-444444444444",
    provider: "FLOW",
    invoiceId: "invoice-test-123",
    factType: "CHARGE_CONFIRMED",
    observationId: "55555555-5555-4555-8555-555555555555",
    currency: "PEN",
    amount: "89.12345678",
    paidAt: "2026-10-11T12:00:00Z",
    binding: {
      state: "WAITING_COMPANY",
      financeState: "INCOMPLETE",
      companyId: null,
      attributionId: null,
      candidateCount: 0,
      checkedAt: "2026-10-11T12:02:00Z",
      nextCheckAt: "2026-10-11T12:03:00Z",
    },
    conflictCount: 0,
    conflictReasons: [],
    missingFields: ["priceList", "discount"],
    reconciliationReasons: ["COMPANY_NOT_OBSERVED", "FINANCIAL_SNAPSHOT_INCOMPLETE"],
    ...overrides,
  };
}
export function billingPage(
  items: AdminBillingEvidence[] = [billingEvidence()],
  overrides: Partial<AdminBillingEvidencePage> = {},
): AdminBillingEvidencePage {
  return { items, nextCursor: null, hasMore: false, limit: 20, ...overrides };
}
