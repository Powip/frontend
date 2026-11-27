const PERU_COUNTRY_CODE = "51";
const MOBILE_LENGTH = 9;

/** Digits only, without the Peruvian country code ("+51 999 888 777" -> "999888777"). */
export function normalizeOlvaPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");

  return digits.length === MOBILE_LENGTH + PERU_COUNTRY_CODE.length &&
    digits.startsWith(PERU_COUNTRY_CODE)
    ? digits.slice(PERU_COUNTRY_CODE.length)
    : digits;
}
