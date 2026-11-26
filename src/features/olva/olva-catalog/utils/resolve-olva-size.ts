import type { OlvaStandardSize } from "../models/olva-standard-size";
import { getOlvaSizeVolume } from "./get-olva-size-volume";

interface ResolveOlvaSizeParams {
  /** The size the user picked; blank means "let Olva choose by weight". */
  sizeId: string | undefined;
  weightKg: unknown;
}

/**
 * The size a shipment will be registered (and quoted) with. A picked size is used as is. With
 * none picked Olva takes the smallest one that supports the weight, so this does the same:
 * that is what lets the price be asked for before the shipment exists.
 */
export function resolveOlvaSize(
  sizes: readonly OlvaStandardSize[],
  { sizeId, weightKg }: ResolveOlvaSizeParams,
): OlvaStandardSize | undefined {
  if (sizeId) return sizes.find((size) => size.id === sizeId);

  const weight = Number(weightKg);

  if (!Number.isFinite(weight) || weight <= 0) return undefined;

  return sizes
    .filter((size) => size.maxWeightKg >= weight)
    .sort(
      (a, b) => getOlvaSizeVolume(a) - getOlvaSizeVolume(b) || a.maxWeightKg - b.maxWeightKg,
    )[0];
}
