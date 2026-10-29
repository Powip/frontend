/** Exact nonnegative decimal arithmetic. Conversion to chart numbers is presentation only. */
export function sumAdvertisingDecimals(values: Array<string | null>): string | null {
  const available = values.filter((value): value is string => value !== null);
  if (!available.length) return null;
  if (available.some((value) => !/^\d+(?:\.\d+)?$/.test(value) || value.length > 1024))
    throw new Error("Importe publicitario inválido.");
  const scale = Math.max(...available.map((value) => value.split(".")[1]?.length ?? 0));
  const total = available.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole + fraction.padEnd(scale, "0"));
  }, BigInt(0));
  if (!scale) return total.toString();
  const digits = total.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function advertisingCurrencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("es-PE", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function advertisingRoundedUnits(amount: string, currency: string): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(amount) || amount.length > 1024)
    throw new Error("Importe publicitario inválido.");
  const places = advertisingCurrencyDigits(currency);
  const [whole, fraction = ""] = amount.split(".");
  const units = BigInt(whole + fraction.slice(0, places).padEnd(places, "0"));
  return units + (Number(fraction[places] ?? "0") >= 5 ? BigInt(1) : BigInt(0));
}

export function advertisingDecimalToMinor(amount: string | null, currency: string): number | null {
  if (amount === null) return null;
  const units = advertisingRoundedUnits(amount, currency);
  return units <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(units) : null;
}

export function formatAdvertisingDecimal(amount: string, currency: string): string {
  const formatter = new Intl.NumberFormat("es-PE", { style: "currency", currency });
  const places = advertisingCurrencyDigits(currency);
  const units = advertisingRoundedUnits(amount, currency);
  const divisor = BigInt(10) ** BigInt(places);
  const fraction = (units % divisor).toString().padStart(places, "0");
  return formatter
    .formatToParts(units / divisor)
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}
