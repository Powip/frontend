export const COUNTRY_CODES = {
  PERU: "PE",
  ECUADOR: "EC",
} as const;

export type CountryCode = (typeof COUNTRY_CODES)[keyof typeof COUNTRY_CODES];
