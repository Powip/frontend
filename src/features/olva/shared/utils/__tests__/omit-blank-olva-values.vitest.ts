import { describe, expect, it } from "vitest";
import { omitBlankOlvaValues } from "../omit-blank-olva-values";

describe("omitBlankOlvaValues", () => {
  it("trims values and drops blank or undefined ones", () => {
    expect(omitBlankOlvaValues({ q: "  sur ", department: " ", province: undefined })).toEqual({
      q: "sur",
    });
  });
});
