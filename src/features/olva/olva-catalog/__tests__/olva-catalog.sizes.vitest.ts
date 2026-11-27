import { describe, expect, it } from "vitest";
import { toOlvaStandardSize } from "../mappers/to-olva-standard-size";
import { buildOlvaStandardSizesResponse } from "../test-utils/olva-catalog.fixtures";
import { getOlvaSizeVolume } from "../utils/get-olva-size-volume";
import { getOlvaSizeWeightError } from "../utils/get-olva-size-weight-error";
import { resolveOlvaSize } from "../utils/resolve-olva-size";

// The catalog as Olva sends it: envelope (0.5 kg), XXS (0.5 kg), S (2 kg), M (5 kg)
const sizes = buildOlvaStandardSizesResponse().map(toOlvaStandardSize);
const [letter, extraSmall, small, middle] = sizes;

describe("getOlvaSizeVolume", () => {
  it("multiplies the measures and counts the envelope as nothing", () => {
    expect(getOlvaSizeVolume(middle)).toBe(40 * 30 * 20);
    expect(getOlvaSizeVolume(letter)).toBe(0);
  });
});

describe("resolveOlvaSize", () => {
  it("uses the size the user picked, whatever the weight", () => {
    expect(resolveOlvaSize(sizes, { sizeId: "middle", weightKg: 0.1 })).toBe(middle);
  });

  it("returns nothing for a size that is not in the catalog", () => {
    expect(resolveOlvaSize(sizes, { sizeId: "huge", weightKg: 1 })).toBeUndefined();
  });

  it("picks the smallest size that supports the weight, like Olva does", () => {
    expect(resolveOlvaSize(sizes, { sizeId: undefined, weightKg: 0.3 })).toBe(letter);
    expect(resolveOlvaSize(sizes, { sizeId: "", weightKg: 1 })).toBe(small);
    expect(resolveOlvaSize(sizes, { sizeId: undefined, weightKg: "2.5" })).toBe(middle);
  });

  it("does not depend on the order the catalog comes in", () => {
    expect(resolveOlvaSize([...sizes].reverse(), { sizeId: undefined, weightKg: 0.5 })).toBe(
      letter,
    );
  });

  it("returns nothing when no size supports the weight or the weight is not a number", () => {
    expect(resolveOlvaSize(sizes, { sizeId: undefined, weightKg: 5.1 })).toBeUndefined();
    expect(resolveOlvaSize(sizes, { sizeId: undefined, weightKg: "" })).toBeUndefined();
    expect(resolveOlvaSize(sizes, { sizeId: undefined, weightKg: 0 })).toBeUndefined();
  });
});

describe("getOlvaSizeWeightError", () => {
  it("is fine while the weight fits", () => {
    expect(getOlvaSizeWeightError(sizes, { sizeId: "extra-small", weightKg: 0.5 })).toBeUndefined();
    expect(getOlvaSizeWeightError(sizes, { sizeId: undefined, weightKg: 3 })).toBeUndefined();
  });

  it("names the size when the weight is above its maximum", () => {
    expect(getOlvaSizeWeightError(sizes, { sizeId: extraSmall.id, weightKg: 1 })).toContain(
      "XXS admite hasta 0.5 kg",
    );
  });

  it("says the heaviest weight Olva takes when no size fits", () => {
    expect(getOlvaSizeWeightError(sizes, { sizeId: undefined, weightKg: 6 })).toBe(
      "Olva admite hasta 5 kg por paquete.",
    );
  });

  it("has nothing to check against without sizes or a usable weight", () => {
    expect(getOlvaSizeWeightError([], { sizeId: "middle", weightKg: 99 })).toBeUndefined();
    expect(getOlvaSizeWeightError(sizes, { sizeId: "middle", weightKg: "" })).toBeUndefined();
  });
});
