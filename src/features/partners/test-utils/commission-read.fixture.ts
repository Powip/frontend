import type {
  CommissionCalculationItem,
  CommissionEvaluation,
  CommissionReadPage,
} from "../models/commission-read";

export const commissionItemFixture: CommissionCalculationItem = {
  id: "11111111-1111-4111-8111-111111111111",
  observationId: "22222222-2222-4222-8222-222222222222",
  paymentId: "33333333-3333-4333-8333-333333333333",
  subscriptionId: "44444444-4444-4444-8444-444444444444",
  companyId: "55555555-5555-4555-8555-555555555555",
  attributionId: "66666666-6666-4666-8666-666666666666",
  partnerId: "77777777-7777-4777-8777-777777777777",
  businessName: null,
  planName: null,
  currency: "PEN",
  kind: "FIRST",
  initialBase: "99999999999999999999.12345678",
  recurringBase: null,
  firstRate: "0.4000000000",
  recurringRate: "0.0600000000",
  residualRate: "0.0000000000",
  grossAmount: "99999999999999999990.12345678",
  partnerFundedAmount: "0.00000001",
  netAmount: "99999999999999999990.12345677",
  approvalId: "88888888-8888-4888-8888-888888888888",
  createdAt: "2026-10-11T10:00:00Z",
};
export const commissionEvaluationFixture: CommissionEvaluation = {
  observationId: commissionItemFixture.observationId,
  companyId: commissionItemFixture.companyId,
  attributionId: commissionItemFixture.attributionId,
  state: "BLOCKED",
  reasons: ["APPROVED_FINANCIAL_CONTEXT_MISSING"],
  itemId: null,
  firstCheckedAt: "2026-10-11T10:00:00Z",
  checkedAt: "2026-10-11T11:00:00Z",
};
export function commissionReadPageFixture<T>(
  items: T[] = [],
  overrides: Partial<CommissionReadPage<T>> = {},
): CommissionReadPage<T> {
  return { items, nextCursor: null, hasMore: false, limit: 20, ...overrides };
}
