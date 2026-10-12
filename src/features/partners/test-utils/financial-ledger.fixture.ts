import type {
  FinancialLedgerBalance,
  FinancialLedgerEntry,
  FinancialLedgerPage,
} from "../models/financial-ledger";

export const ledgerEntryFixture: FinancialLedgerEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  postingId: "22222222-2222-4222-8222-222222222222",
  calculationItemId: "33333333-3333-4333-8333-333333333333",
  partnerId: "44444444-4444-4444-8444-444444444444",
  observationId: "55555555-5555-4555-8555-555555555555",
  companyId: "66666666-6666-4666-8666-666666666666",
  paymentId: "77777777-7777-4777-8777-777777777777",
  subscriptionId: "88888888-8888-4888-8888-888888888888",
  sourceItemKind: "FIRST",
  currency: "PEN",
  kind: "GROSS_COMMISSION",
  signedAmount: "34.50",
  postedAt: "2026-10-11T12:00:00Z",
};
export const ledgerPageFixture = (
  items: FinancialLedgerEntry[] = [ledgerEntryFixture],
  overrides: Partial<FinancialLedgerPage> = {},
): FinancialLedgerPage => ({ items, limit: 20, hasMore: false, nextCursor: null, ...overrides });
export const ledgerBalanceFixture: FinancialLedgerBalance = {
  partnerId: ledgerEntryFixture.partnerId,
  currency: "PEN",
  postedLedgerBalance: "34.50",
  postedEntryCount: 1,
  availability: "POSTED_ENTRIES",
  settlementEligibility: "NOT_EVALUATED",
  asOf: "2026-10-11T12:00:01Z",
};
