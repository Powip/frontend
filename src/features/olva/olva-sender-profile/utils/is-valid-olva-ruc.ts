const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
const PREFIXES = ["10", "15", "16", "17", "20"] as const;

/**
 * Peruvian taxpayer number: 11 digits, a known prefix and the SUNAT modulo-11 check digit.
 * Same rule as domain/sender-profiles/ruc.value-object.ts on the backend, so the form
 * rejects what the API would reject.
 */
export function isValidOlvaRuc(raw: string): boolean {
  const candidate = raw.trim();

  if (!/^\d{11}$/.test(candidate)) return false;
  if (!PREFIXES.some((prefix) => candidate.startsWith(prefix))) return false;

  const sum = WEIGHTS.reduce(
    (total, weight, index) => total + weight * Number(candidate[index]),
    0,
  );
  const checkDigit = (11 - (sum % 11)) % 10;

  return checkDigit === Number(candidate[10]);
}
