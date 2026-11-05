import type { OlvaStandardSize } from "../models/olva-standard-size";
import { resolveOlvaSize } from "./resolve-olva-size";

interface GetOlvaSizeWeightErrorParams {
  sizeId: string | undefined;
  weightKg: unknown;
}

/**
 * Olva answers 422 when the weight does not fit the size, so the form says it first.
 * Returns `undefined` when it fits, or when there is nothing to check against (the sizes did
 * not load, or the weight is not a number yet: those have their own messages).
 */
export function getOlvaSizeWeightError(
  sizes: readonly OlvaStandardSize[],
  { sizeId, weightKg }: GetOlvaSizeWeightErrorParams,
): string | undefined {
  const weight = Number(weightKg);

  if (sizes.length === 0 || !Number.isFinite(weight) || weight <= 0) return undefined;

  if (sizeId) {
    const size = sizes.find((candidate) => candidate.id === sizeId);

    return size && weight > size.maxWeightKg
      ? `El tamaño ${size.label} admite hasta ${size.maxWeightKg} kg. Elige otro tamaño o "Automático".`
      : undefined;
  }

  if (resolveOlvaSize(sizes, { sizeId, weightKg })) return undefined;

  const heaviest = Math.max(...sizes.map((size) => size.maxWeightKg));

  return `Olva admite hasta ${heaviest} kg por paquete.`;
}
