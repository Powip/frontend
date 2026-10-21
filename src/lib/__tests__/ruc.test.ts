import { isValidRuc } from "@/lib/ruc";

describe("isValidRuc (FEAT-24 H0)", () => {
  it.each(["20100047218", "20131312955", "10467793549"])("%s es válido", (ruc) => {
    expect(isValidRuc(ruc)).toBe(true);
  });

  it.each(["20100047219", "30100047218", "2010004721", "2010004721A", ""])("%s no es válido", (ruc) => {
    expect(isValidRuc(ruc)).toBe(false);
  });
});
