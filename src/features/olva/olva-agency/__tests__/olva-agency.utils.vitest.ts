import { describe, expect, it } from "vitest";
import { isOlvaAgencyOpenAt } from "../utils/is-olva-agency-open-at";
import { isValidOlvaCoordinates } from "../utils/is-valid-olva-coordinates";
import { normalizeOlvaAgencyFilters } from "../utils/normalize-olva-agency-filters";

const schedule = {
  monday: { open: "08:00", close: "18:00" },
  tuesday: { open: null, close: null },
};

// Lima is UTC-5 all year: 2026-10-26 is a Monday
const at = (utc: string) => new Date(`2026-10-26T${utc}:00Z`);

describe("isOlvaAgencyOpenAt", () => {
  it("is open inside the slot on Lima's clock, closing is exclusive", () => {
    expect(isOlvaAgencyOpenAt(schedule, at("13:00"))).toBe(true); // 08:00 Lima
    expect(isOlvaAgencyOpenAt(schedule, at("12:59"))).toBe(false); // 07:59
    expect(isOlvaAgencyOpenAt(schedule, at("22:59"))).toBe(true); // 17:59
    expect(isOlvaAgencyOpenAt(schedule, at("23:00"))).toBe(false); // 18:00
  });

  it("is closed on closed or unknown days", () => {
    expect(isOlvaAgencyOpenAt(schedule, new Date("2026-10-27T17:00:00Z"))).toBe(false);
    expect(isOlvaAgencyOpenAt(schedule, new Date("2026-10-28T17:00:00Z"))).toBe(false);
  });
});

describe("isValidOlvaCoordinates", () => {
  it("validates ranges and finiteness", () => {
    expect(isValidOlvaCoordinates(-12, -77)).toBe(true);
    expect(isValidOlvaCoordinates(91, 0)).toBe(false);
    expect(isValidOlvaCoordinates(0, -181)).toBe(false);
    expect(isValidOlvaCoordinates(Number.NaN, 0)).toBe(false);
  });
});

describe("normalizeOlvaAgencyFilters", () => {
  it("makes blank filters equal to no filters", () => {
    expect(normalizeOlvaAgencyFilters({ q: "  ", district: "" })).toEqual({});
  });
});
