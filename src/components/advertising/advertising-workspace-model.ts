export function advertisingBasisPoints(value: string): number | null {
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount > 0 && amount <= 10_000 ? amount : null;
}
export function advertisingSharePercent(value: number) {
  return `${Math.floor(value / 100)}${value % 100 ? `.${String(value % 100).padStart(2, "0")}` : ""}`;
}
export function advertisingInputDecimal(value: string) {
  const decimal = value.trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(decimal) && decimal.length <= 128 ? decimal : null;
}
