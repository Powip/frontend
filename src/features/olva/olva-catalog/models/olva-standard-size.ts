export interface OlvaStandardSize {
  /** Olva's own code for the size ("letter", "extra-small"…), sent as `package.sizeId`. */
  id: string;
  label: string;
  /** `null` for the envelope, which has no fixed measures. */
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  maxWeightKg: number;
}
