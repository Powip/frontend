import { normalizeOlvaPlaceName } from "../../shared/utils/normalize-olva-place-name";
import type { OlvaUbigeo } from "../models/olva-ubigeo";

export interface OlvaUbigeoNames {
  department: string | null | undefined;
  province: string | null | undefined;
  district: string | null | undefined;
}

/**
 * The ubigeo whose department, province and district match these names (ignoring case, accents
 * and extra spaces), for example from a customer's address. All three must match, since a
 * district name alone repeats across the country. Undefined when nothing matches.
 */
export function findOlvaUbigeoByNames(
  ubigeos: readonly OlvaUbigeo[],
  names: OlvaUbigeoNames,
): OlvaUbigeo | undefined {
  const department = normalizeOlvaPlaceName(names.department);
  const province = normalizeOlvaPlaceName(names.province);
  const district = normalizeOlvaPlaceName(names.district);

  if (!department || !province || !district) return undefined;

  return ubigeos.find(
    (ubigeo) =>
      normalizeOlvaPlaceName(ubigeo.department) === department &&
      normalizeOlvaPlaceName(ubigeo.province) === province &&
      normalizeOlvaPlaceName(ubigeo.district) === district,
  );
}
