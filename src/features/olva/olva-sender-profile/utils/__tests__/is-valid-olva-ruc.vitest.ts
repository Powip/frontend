import { describe, expect, it } from "vitest";
import { isValidOlvaRuc } from "../is-valid-olva-ruc";

describe("isValidOlvaRuc", () => {
  it.each(["20616141971", "20123456786"])("accepts %s", (ruc) => {
    expect(isValidOlvaRuc(ruc)).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isValidOlvaRuc("  20616141971 ")).toBe(true);
  });

  it.each([
    ["wrong check digit", "20616141972"],
    ["too short", "2061614197"],
    ["too long", "206161419711"],
    ["letters", "2061614197A"],
    ["unknown prefix", "30616141971"],
    ["empty", ""],
  ])("rejects %s", (_label, ruc) => {
    expect(isValidOlvaRuc(ruc)).toBe(false);
  });
});
