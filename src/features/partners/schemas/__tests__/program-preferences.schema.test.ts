import type { ProgramPreferencesResponse } from "../../models/program-preferences";
import {
  programPreferencesCommandSchema,
  programPreferencesDiscountPctSchema,
  programPreferencesResponseSchema,
  programPreferencesSettingsSchema,
} from "../program-preferences.schema";

function response(): ProgramPreferencesResponse {
  return {
    settings: {
      optionCode: "A",
      discountPct: "2.7500000000",
      version: 0,
      updatedAt: "2026-10-11T10:00:00Z",
    },
    effectiveTerms: {
      status: "NOT_CONFIGURED",
      policyVersion: null,
      firstPaymentRate: null,
      recurringPaymentRate: null,
    },
    catalog: {
      source: "POWIP_PARTNERS_PROGRAM_SPEC",
      version: "2.0",
      date: "2026-08-17",
      options: [
        { code: "A", firstPaymentPct: "40", recurringPaymentPct: "6" },
        { code: "B", firstPaymentPct: "70", recurringPaymentPct: "3" },
        { code: "C", firstPaymentPct: "50", recurringPaymentPct: "8" },
      ],
    },
  };
}

const command = {
  optionCode: "B",
  discountPct: "5.00",
  expectedVersion: null,
  reason: "Protected reason",
};

it("keeps historical decimal strings, null effective rates and absent settings without defaults", () => {
  const historical = response();
  expect(programPreferencesResponseSchema.parse(historical)).toEqual(historical);
  expect(programPreferencesResponseSchema.parse({ ...historical, settings: null })).toEqual({
    ...historical,
    settings: null,
  });
});

it.each(["0", "0.0000000000", "2.7500000000", "5.00", "9.9999999999", "10", "10.0000000000"])(
  "preserves allowed exact decimal %s",
  (value) => {
    expect(programPreferencesDiscountPctSchema.parse(value)).toBe(value);
  },
);

it.each([
  0,
  null,
  "",
  "-0",
  "-1",
  "+1",
  "1e0",
  "00",
  "01",
  ".5",
  "5.",
  " 5",
  "5 ",
  "0,5",
  "11",
  "10.0000000001",
  "1.12345678901",
])("rejects a coerced, non-canonical or out-of-range decimal %#", (value) => {
  expect(programPreferencesDiscountPctSchema.safeParse(value).success).toBe(false);
});

it("trims the required reason while preserving the exact command decimal and nullable version", () => {
  expect(
    programPreferencesCommandSchema.parse({ ...command, reason: " Protected reason " }),
  ).toEqual(command);
  expect(
    programPreferencesCommandSchema.parse({ ...command, expectedVersion: Number.MAX_SAFE_INTEGER })
      .expectedVersion,
  ).toBe(Number.MAX_SAFE_INTEGER);
  expect(
    programPreferencesCommandSchema.parse({ ...command, reason: "a".repeat(1000) }).reason,
  ).toHaveLength(1000);
});

it.each([
  { optionCode: "D" },
  { optionCode: "a" },
  { optionCode: null },
  { expectedVersion: undefined },
  { expectedVersion: -1 },
  { expectedVersion: 0.5 },
  { expectedVersion: "0" },
  { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
  { reason: " " },
  { reason: "a".repeat(1001) },
  { reason: "line\nbreak" },
  { reason: "\u0000" },
  { reason: "\u007f" },
  { reason: "\u0085" },
  { reason: "\u009f" },
  { reason: null },
  { actorSubject: "client-selected-owner" },
  { policyVersion: "active" },
])("rejects invalid or expanded commands %#", (override) => {
  expect(programPreferencesCommandSchema.safeParse({ ...command, ...override }).success).toBe(
    false,
  );
});

it.each([
  "2026-10-11T10:00:00Z",
  "2026-10-11T10:00:00.1Z",
  "2026-10-11T10:00:00.123456789Z",
  "2028-02-29T23:59:59Z",
])("preserves a valid UTC instant %s", (updatedAt) => {
  expect(
    programPreferencesSettingsSchema.parse({ ...response().settings, updatedAt }).updatedAt,
  ).toBe(updatedAt);
});

it.each([
  "2026-02-29T10:00:00Z",
  "2026-02-30T10:00:00Z",
  "2026-04-31T10:00:00Z",
  "2026-13-01T10:00:00Z",
  "2026-10-11T24:00:00Z",
  "2026-10-11T10:60:00Z",
  "2026-10-11T10:00:60Z",
  "2026-10-11T10:00Z",
  "2026-10-11T10:00:00+00:00",
  "2026-10-11T10:00:00-05:00",
  "2026-10-11T10:00:00.1234567890Z",
  "2026-10-11T10:00:00",
  "tomorrow",
])("rejects an invalid, normalized or non-UTC timestamp %s", (updatedAt) => {
  expect(
    programPreferencesSettingsSchema.safeParse({ ...response().settings, updatedAt }).success,
  ).toBe(false);
});

it.each([
  { version: -1 },
  { version: 0.1 },
  { version: "0" },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { reason: "private reason" },
  { ownerId: "client-selected-owner" },
])("rejects invalid or expanded settings %#", (override) => {
  expect(
    programPreferencesSettingsSchema.safeParse({ ...response().settings, ...override }).success,
  ).toBe(false);
});

it("accepts the terminal safe read version without implying another available write", () => {
  expect(
    programPreferencesSettingsSchema.parse({
      ...response().settings,
      version: Number.MAX_SAFE_INTEGER,
    }).version,
  ).toBe(Number.MAX_SAFE_INTEGER);
});

it.each([
  { status: "ACTIVE" },
  { policyVersion: 0 },
  { firstPaymentRate: "0.4" },
  { recurringPaymentRate: "0.06" },
  { recurringPaymentCount: 12 },
])("does not convert the factual catalog into effective financial terms %#", (override) => {
  const actual = response();
  expect(
    programPreferencesResponseSchema.safeParse({
      ...actual,
      effectiveTerms: { ...actual.effectiveTerms, ...override },
    }).success,
  ).toBe(false);
});

it.each([
  { source: "DRAFT_POLICY" },
  { version: "3.0" },
  { date: "2026-08-18" },
  { currency: "PEN" },
])("rejects an unapproved or expanded catalog envelope %#", (override) => {
  const actual = response();
  expect(
    programPreferencesResponseSchema.safeParse({
      ...actual,
      catalog: { ...actual.catalog, ...override },
    }).success,
  ).toBe(false);
});

it("rejects reordering, changed rates, numeric rates, duplicates and extra catalog entries", () => {
  const actual = response();
  const [a, b, c] = actual.catalog.options;
  for (const options of [
    [b, a, c],
    [a, b],
    [a, b, c, c],
    [a, b, b],
    [{ ...a, firstPaymentPct: "41" }, b, c],
    [{ ...a, recurringPaymentPct: 6 }, b, c],
    [a, { ...b, firstPaymentPct: "70.0" }, c],
    [a, b, { ...c, label: "invented" }],
  ]) {
    expect(
      programPreferencesResponseSchema.safeParse({
        ...actual,
        catalog: { ...actual.catalog, options },
      }).success,
    ).toBe(false);
  }
});

it("rejects missing or added response fields instead of inventing profile and financial facts", () => {
  const actual = response();
  for (const invalid of [
    { ...actual, settings: undefined },
    { ...actual, catalog: undefined },
    { ...actual, effectiveTerms: undefined },
    { ...actual, tier: "Bronce" },
    { ...actual, mrr: "0" },
    { ...actual, expectedEarnings: "0" },
  ]) {
    expect(programPreferencesResponseSchema.safeParse(invalid).success).toBe(false);
  }
});
