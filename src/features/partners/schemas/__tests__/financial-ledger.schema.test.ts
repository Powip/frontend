import {
  ledgerBalanceFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
} from "../../test-utils/financial-ledger.fixture";
import {
  financialLedgerBalanceSchema,
  financialLedgerEntrySchema,
  financialLedgerPageSchema,
} from "../financial-ledger.schema";

it("preserves exact signed decimal strings including large aggregate balances", () => {
  expect(financialLedgerEntrySchema.parse(ledgerEntryFixture).signedAmount).toBe("34.50");
  expect(
    financialLedgerBalanceSchema.parse({
      ...ledgerBalanceFixture,
      postedLedgerBalance: "-1000000000000000000000.12345678",
    }).postedLedgerBalance,
  ).toBe("-1000000000000000000000.12345678");
});
it.each(["+1", "1e2", " 1", "01", "-0", "-0.00", "NaN", "1.123456789", 34.5])(
  "rejects non-exact amount %p",
  (signedAmount) => {
    expect(
      financialLedgerEntrySchema.safeParse({ ...ledgerEntryFixture, signedAmount }).success,
    ).toBe(false);
  },
);
it("does not reverse the economic sign or multiply funding", () => {
  expect(
    financialLedgerEntrySchema.safeParse({ ...ledgerEntryFixture, signedAmount: "-5" }).success,
  ).toBe(false);
  expect(
    financialLedgerEntrySchema.safeParse({
      ...ledgerEntryFixture,
      kind: "PARTNER_FUNDED_DISCOUNT",
      signedAmount: "5",
    }).success,
  ).toBe(false);
  expect(
    financialLedgerEntrySchema.parse({
      ...ledgerEntryFixture,
      kind: "PARTNER_FUNDED_DISCOUNT",
      signedAmount: "-5",
    }).signedAmount,
  ).toBe("-5");
});
it("rejects PII, unsupported currency and invented payout status", () => {
  expect(
    financialLedgerEntrySchema.safeParse({ ...ledgerEntryFixture, email: "private@example.test" })
      .success,
  ).toBe(false);
  expect(
    financialLedgerEntrySchema.safeParse({ ...ledgerEntryFixture, currency: "USD" }).success,
  ).toBe(false);
  expect(
    financialLedgerBalanceSchema.safeParse({
      ...ledgerBalanceFixture,
      settlementEligibility: "PAYABLE",
    }).success,
  ).toBe(false);
  expect(
    financialLedgerBalanceSchema.safeParse({ ...ledgerBalanceFixture, tax: "0" }).success,
  ).toBe(false);
});
it("rejects unsafe counts, false empty balances and inconsistent availability", () => {
  expect(
    financialLedgerBalanceSchema.safeParse({
      ...ledgerBalanceFixture,
      postedEntryCount: Number.MAX_SAFE_INTEGER + 1,
    }).success,
  ).toBe(false);
  expect(
    financialLedgerBalanceSchema.safeParse({
      ...ledgerBalanceFixture,
      postedEntryCount: 0,
      availability: "NO_POSTED_ENTRIES",
    }).success,
  ).toBe(false);
  expect(
    financialLedgerBalanceSchema.safeParse({
      ...ledgerBalanceFixture,
      availability: "NO_POSTED_ENTRIES",
    }).success,
  ).toBe(false);
  expect(
    financialLedgerBalanceSchema.parse({
      ...ledgerBalanceFixture,
      postedLedgerBalance: "0",
      postedEntryCount: 0,
      availability: "NO_POSTED_ENTRIES",
    }).postedLedgerBalance,
  ).toBe("0");
});
it("pagination requires unique bounded entries and an actual cursor", () => {
  expect(financialLedgerPageSchema.parse(ledgerPageFixture()).items).toHaveLength(1);
  expect(
    financialLedgerPageSchema.safeParse(ledgerPageFixture([ledgerEntryFixture, ledgerEntryFixture]))
      .success,
  ).toBe(false);
  expect(
    financialLedgerPageSchema.safeParse(
      ledgerPageFixture([], { hasMore: true, nextCursor: "opaque", limit: 1 }),
    ).success,
  ).toBe(false);
  expect(
    financialLedgerPageSchema.safeParse(
      ledgerPageFixture([ledgerEntryFixture], { nextCursor: "unexpected" }),
    ).success,
  ).toBe(false);
});
it.each(["2026-02-30T12:00:00Z", "2026-10-11", "2026-10-11T12:00:00-05:00"])(
  "requires a real UTC instant: %s",
  (asOf) => {
    expect(financialLedgerBalanceSchema.safeParse({ ...ledgerBalanceFixture, asOf }).success).toBe(
      false,
    );
  },
);
