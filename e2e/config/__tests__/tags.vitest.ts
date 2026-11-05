import { describe, expect, it } from "vitest";
import { resolveGrepInvert, TAGS } from "../tags";

describe("resolveGrepInvert", () => {
  it("excludes @writes-olva specs unless real shipments are allowed", () => {
    const invert = resolveGrepInvert({ E2E_ALLOW_REAL_SHIPMENTS: false });

    expect(invert?.test(`registers a lot ${TAGS.WRITES_OLVA}`)).toBe(true);
    expect(invert?.test(`opens the modal ${TAGS.SMOKE}`)).toBe(false);
    expect(invert?.test(`fails an order ${TAGS.FAULT}`)).toBe(false);
  });

  it("excludes nothing when real shipments are allowed", () => {
    expect(resolveGrepInvert({ E2E_ALLOW_REAL_SHIPMENTS: true })).toBeUndefined();
  });
});
