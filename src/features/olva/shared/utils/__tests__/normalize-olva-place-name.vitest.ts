import { describe, expect, it } from "vitest";
import { normalizeOlvaPlaceName } from "../normalize-olva-place-name";

describe("normalizeOlvaPlaceName", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(normalizeOlvaPlaceName("  ÁNCASH ")).toBe("ancash");
    expect(normalizeOlvaPlaceName("San   Martín")).toBe("san martin");
  });

  it("returns an empty key for a missing name", () => {
    expect(normalizeOlvaPlaceName(null)).toBe("");
    expect(normalizeOlvaPlaceName(undefined)).toBe("");
    expect(normalizeOlvaPlaceName("   ")).toBe("");
  });
});
