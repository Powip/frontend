import { partnerReferralMetricsSchema } from "../partner-referral-metrics.schema";

const metrics = {
  claimCaptures: 12,
  attachedClaims: 7,
  attributedCompanies: 4,
  asOf: "2026-10-11T10:00:00Z",
};

it("accepts zero and terminal safe counts without inventing activity", () => {
  expect(
    partnerReferralMetricsSchema.parse({
      ...metrics,
      claimCaptures: 0,
      attachedClaims: 0,
      attributedCompanies: Number.MAX_SAFE_INTEGER,
    }),
  ).toEqual({
    ...metrics,
    claimCaptures: 0,
    attachedClaims: 0,
    attributedCompanies: Number.MAX_SAFE_INTEGER,
  });
});

describe.each(["claimCaptures", "attachedClaims", "attributedCompanies"])(
  "strict %s count",
  (field) => {
    it.each([-1, 0.1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "0", null, undefined])(
      "rejects malformed count %#",
      (value) => {
        expect(partnerReferralMetricsSchema.safeParse({ ...metrics, [field]: value }).success).toBe(
          false,
        );
      },
    );
  },
);

it.each(["2026-10-11T10:00:00Z", "2026-10-11T10:00:00.123456789Z", "2028-02-29T23:59:59Z"])(
  "preserves UTC instant %s",
  (asOf) => {
    expect(partnerReferralMetricsSchema.parse({ ...metrics, asOf }).asOf).toBe(asOf);
  },
);
it.each([
  "tomorrow",
  "2026-02-30T10:00:00Z",
  "2026-02-29T10:00:00Z",
  "2026-04-31T10:00:00Z",
  "2026-10-11T10:00Z",
  "2026-10-11T24:00:00Z",
  "2026-10-11T10:00:00+00:00",
  "2026-10-11T10:00:00.1234567890Z",
  null,
])("rejects invalid or non-UTC instant %#", (asOf) => {
  expect(partnerReferralMetricsSchema.safeParse({ ...metrics, asOf }).success).toBe(false);
});
it.each([
  "clicks",
  "codeUses",
  "conversions",
  "paidCompanies",
  "mrr",
  "partnerId",
  "country",
  "discountPct",
])("rejects undocumented field %s", (field) => {
  expect(partnerReferralMetricsSchema.safeParse({ ...metrics, [field]: 0 }).success).toBe(false);
});
