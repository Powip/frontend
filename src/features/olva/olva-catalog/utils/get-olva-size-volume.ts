import type { OlvaStandardSize } from "../models/olva-standard-size";

/** The box volume in cm³; the envelope has no measures, so it counts as the smallest (0). */
export function getOlvaSizeVolume(
  size: Pick<OlvaStandardSize, "lengthCm" | "widthCm" | "heightCm">,
): number {
  const { lengthCm, widthCm, heightCm } = size;

  if (lengthCm === null || widthCm === null || heightCm === null) return 0;

  return lengthCm * widthCm * heightCm;
}
