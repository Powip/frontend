import { normalizeOlvaPlaceName } from "@/features/olva/shared/utils/normalize-olva-place-name";

/** Anything with a name: an agency division or a node of the ubigeo tree. */
interface OlvaNamedDivision {
  name: string;
}

/**
 * The Olva division (department, province or district) that a customer's address points to.
 * Tries each candidate in order against the divisions Olva has (agencies or ubigeos), exact match first
 * ("San Isidro" = "SAN ISIDRO") and then a containment match ("Lima" in "LIMA METROPOLITANA").
 * Returns "" when nothing matches, so the user picks it by hand.
 */
export function findOlvaDivisionName(
  candidates: readonly (string | null | undefined)[],
  divisions: readonly OlvaNamedDivision[],
): string {
  const normalizedDivisions = divisions.map((division) => ({
    name: division.name,
    key: normalizeOlvaPlaceName(division.name),
  }));

  for (const candidate of candidates) {
    const key = normalizeOlvaPlaceName(candidate);

    if (!key) continue;

    const match =
      normalizedDivisions.find((division) => division.key === key) ??
      normalizedDivisions.find(
        (division) => division.key.includes(key) || key.includes(division.key),
      );

    if (match) return match.name;
  }

  return "";
}
