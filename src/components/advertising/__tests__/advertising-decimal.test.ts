import {
  advertisingCurrencyDigits,
  advertisingDecimalToMinor,
  advertisingRoundedUnits,
  formatAdvertisingDecimal,
  sumAdvertisingDecimals,
} from "../advertising-decimal";

describe("exact advertising decimals", () => {
  it("adds provider precision before rounding the displayed currency", () => {
    const total = sumAdvertisingDecimals(["0.005", "0.005"]);

    expect(total).toBe("0.010");
    expect(advertisingDecimalToMinor(total, "PEN")).toBe(1);
    if (total === null) throw new Error("Expected an exact total");
    expect(formatAdvertisingDecimal(total, "PEN")).toContain("0.01");
    // Rounding each provider row would incorrectly produce two cents.
    expect(advertisingDecimalToMinor("0.005", "PEN")).toBe(1);
  });

  it("handles different scales and carries without floating point arithmetic", () => {
    expect(sumAdvertisingDecimals(["99.999", "0.001", "0"])).toBe("100.000");
    expect(sumAdvertisingDecimals(["0.1", "0.2", "0.000000000000000001"])).toBe(
      "0.300000000000000001",
    );
  });

  it("keeps missing amounts distinct from confirmed zero", () => {
    expect(sumAdvertisingDecimals([])).toBeNull();
    expect(sumAdvertisingDecimals([null, null])).toBeNull();
    expect(advertisingDecimalToMinor(null, "PEN")).toBeNull();
    expect(sumAdvertisingDecimals([null, "0.00"])).toBe("0.00");
    expect(advertisingDecimalToMinor("0.00", "PEN")).toBe(0);
  });

  it("uses the fraction digits of JPY and KWD for presentation", () => {
    expect(advertisingCurrencyDigits("JPY")).toBe(0);
    expect(advertisingRoundedUnits("12.49", "JPY")).toBe(BigInt(12));
    expect(advertisingRoundedUnits("12.50", "JPY")).toBe(BigInt(13));
    expect(formatAdvertisingDecimal("12.50", "JPY")).toMatch(/13$/);

    expect(advertisingCurrencyDigits("KWD")).toBe(3);
    expect(advertisingRoundedUnits("1.2344", "KWD")).toBe(BigInt(1234));
    expect(advertisingRoundedUnits("1.2345", "KWD")).toBe(BigInt(1235));
    expect(formatAdvertisingDecimal("1.2345", "KWD")).toContain("1.235");
    expect(advertisingDecimalToMinor("0.0005", "KWD")).toBe(1);
  });

  it("retains exact large totals even when a numeric chart value is unsafe", () => {
    const total = sumAdvertisingDecimals(["90071992547409931234567890.125", "0.005"]);

    expect(total).toBe("90071992547409931234567890.130");
    expect(advertisingDecimalToMinor(total, "PEN")).toBeNull();
    if (total === null) throw new Error("Expected an exact total");
    expect(formatAdvertisingDecimal(total, "PEN").replace(/[^\d.]/g, "")).toBe(
      "90071992547409931234567890.13",
    );
    expect(advertisingDecimalToMinor("90071992547409.91", "PEN")).toBe(Number.MAX_SAFE_INTEGER);
    expect(advertisingDecimalToMinor("90071992547409.915", "PEN")).toBeNull();
  });

  it.each(["", "NaN", "Infinity", "-1", "1e3", "1.", ".5", " 1"])(
    "rejects an invalid provider amount %j rather than manufacturing zero",
    (value) => {
      expect(() => sumAdvertisingDecimals([value])).toThrow("Importe publicitario inválido");
      expect(() => advertisingRoundedUnits(value, "PEN")).toThrow("Importe publicitario inválido");
    },
  );

  it("bounds input size before allocating arbitrary precision integers", () => {
    const excessive = "1".repeat(1025);
    expect(() => sumAdvertisingDecimals([excessive])).toThrow("Importe publicitario inválido");
    expect(() => formatAdvertisingDecimal(excessive, "PEN")).toThrow(
      "Importe publicitario inválido",
    );
  });
});
