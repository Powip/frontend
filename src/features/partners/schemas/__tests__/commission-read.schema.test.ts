import {
  commissionEvaluationFixture,
  commissionItemFixture,
  commissionReadPageFixture,
} from "../../test-utils/commission-read.fixture";
import {
  commissionCalculationItemSchema,
  commissionEvaluationSchema,
  commissionEvaluationsPageSchema,
  commissionItemsPageSchema,
  commissionMoneySchema,
  commissionPageParamsSchema,
  commissionRateSchema,
} from "../commission-read.schema";

it("preserves exact strings above JS integer precision, nullable bases/names and real IDs", () => {
  expect(commissionCalculationItemSchema.parse(commissionItemFixture)).toEqual(
    commissionItemFixture,
  );
  expect(
    commissionItemsPageSchema.parse(commissionReadPageFixture([commissionItemFixture])),
  ).toEqual(commissionReadPageFixture([commissionItemFixture]));
});
it.each(["0", "0.00000000", "99999999999999999999.99999999"])(
  "accepts exact bounded money %s",
  (value) => {
    expect(commissionMoneySchema.parse(value)).toBe(value);
  },
);
it.each([0, null, "", "-1", "+1", "1e2", "01", "1.123456789", "100000000000000000000", " 1", "1."])(
  "rejects malformed money %#",
  (value) => {
    expect(commissionMoneySchema.safeParse(value).success).toBe(false);
  },
);
it.each(["0", "0.1234567890", "1", "1.0000000000"])("accepts exact rate %s", (value) => {
  expect(commissionRateSchema.parse(value)).toBe(value);
});
it.each([0, null, "1.0000000001", "0.12345678901", "-0", "01", "2", ".4", "4e-1"])(
  "rejects malformed rate %#",
  (value) => {
    expect(commissionRateSchema.safeParse(value).success).toBe(false);
  },
);
it.each([
  { residualRate: "0.0200000000" },
  { residualRate: "0.0199999999" },
  { kind: "RECURRING", initialBase: null, recurringBase: "80.00" },
  { kind: "ANNUAL", recurringBase: "80.00" },
])("accepts documented nullable/typed evidence %#", (override) => {
  expect(
    commissionCalculationItemSchema.safeParse({ ...commissionItemFixture, ...override }).success,
  ).toBe(true);
});
it.each([
  { residualRate: "0.0200000001" },
  { residualRate: "0.1" },
  { currency: "USD" },
  { kind: "PAID" },
  { id: "not-a-uuid" },
  { paymentId: null },
  { approvalId: null },
  { netAmount: 12.4 },
  { initialBase: undefined },
  { balance: "10" },
  { accountNumber: "private" },
  { createdAt: "2026-02-30T10:00:00Z" },
])("rejects expanded or invalid calculation evidence %#", (override) => {
  expect(
    commissionCalculationItemSchema.safeParse({ ...commissionItemFixture, ...override }).success,
  ).toBe(false);
});
it("supports blocked nullable identities but GENERATED requires its recorded item and no reasons", () => {
  expect(
    commissionEvaluationSchema.parse({
      ...commissionEvaluationFixture,
      companyId: null,
      attributionId: null,
    }),
  ).toEqual({ ...commissionEvaluationFixture, companyId: null, attributionId: null });
  expect(
    commissionEvaluationSchema.safeParse({ ...commissionEvaluationFixture, state: "GENERATED" })
      .success,
  ).toBe(false);
  expect(
    commissionEvaluationSchema.parse({
      ...commissionEvaluationFixture,
      state: "GENERATED",
      reasons: [],
      itemId: commissionItemFixture.id,
    }).state,
  ).toBe("GENERATED");
});
it.each([
  { reasons: ["private@example.com"] },
  { reasons: ["<script>private</script>"] },
  { reasons: ["raw provider error"] },
  { reasons: Array.from({ length: 33 }, () => "FINANCIAL_INPUTS_MISSING") },
  { state: "READY_TO_PAY" },
  { checkedAt: "2026-10-11T11:00:00+00:00" },
  { rawContext: {} },
])("rejects unsafe/expanded evaluations %#", (override) => {
  expect(
    commissionEvaluationSchema.safeParse({ ...commissionEvaluationFixture, ...override }).success,
  ).toBe(false);
});
it.each([
  { limit: 0 },
  { limit: 101 },
  { limit: 1.2 },
  { limit: "20" },
  { cursor: "" },
  { cursor: "padded=" },
  { cursor: "a".repeat(513) },
  { partnerId: "selected-owner" },
  { country: "PE" },
])("rejects unsafe/client-scoped params %#", (params) => {
  expect(commissionPageParamsSchema.safeParse(params).success).toBe(false);
});
it.each([
  { nextCursor: "cursor", hasMore: false },
  { nextCursor: null, hasMore: true },
  { limit: 1, items: [commissionItemFixture, commissionItemFixture] },
  { hasMore: true, nextCursor: "cursor" },
  { total: "123" },
])("rejects inconsistent item page metadata %#", (override) => {
  expect(
    commissionItemsPageSchema.safeParse({
      ...commissionReadPageFixture([commissionItemFixture]),
      ...override,
    }).success,
  ).toBe(false);
});
it("keeps independent consistent item/evaluation page contracts and accepts empty evidence", () => {
  expect(commissionItemsPageSchema.parse(commissionReadPageFixture()).items).toEqual([]);
  expect(
    commissionEvaluationsPageSchema.parse(
      commissionReadPageFixture([commissionEvaluationFixture], {
        limit: 1,
        hasMore: true,
        nextCursor: "opaque_cursor",
      }),
    ).hasMore,
  ).toBe(true);
  expect(
    commissionEvaluationsPageSchema.safeParse(
      commissionReadPageFixture([commissionEvaluationFixture, commissionEvaluationFixture]),
    ).success,
  ).toBe(false);
});
