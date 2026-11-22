import type { ShalomAgencyOption } from "@/services/shalomService";

/** Ubicación de entrega del cliente. */
export interface AgencyLocation {
  department?: string | null;
  province?: string | null;
  district?: string | null;
}

/** Nivel con el que se encontraron agencias: el más cercano que tenga alguna. */
export type AgencyLocationLevel = "district" | "province" | "department" | "none";

export interface AgencyLocationFilter {
  level: AgencyLocationLevel;
  agencies: ShalomAgencyOption[];
}

/** Sin tildes ni mayúsculas, y con cualquier signo como separador de palabras. */
const words = (value?: string | null): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const hasAgencyLocation = (location?: AgencyLocation | null): boolean =>
  !!location && [location.department, location.province, location.district].some((part) => words(part));

/** Clave estable de la ubicación: cambia solo si cambia de verdad (no por tildes o mayúsculas). */
export const agencyLocationKey = (location?: AgencyLocation | null): string =>
  [location?.department, location?.province, location?.district].map(words).join("|");

/**
 * Agencias válidas para la ubicación del cliente: primero las del mismo distrito; si no hay, las
 * de la misma provincia; si no, las del departamento. Con `level: "none"` no hay ninguna.
 *
 * El catálogo de Shalom trae departamento y provincia, pero no el distrito como campo: el
 * distrito se busca como palabra completa en el nombre, el lugar y la dirección de la agencia,
 * dentro de la provincia (o del departamento, si la provincia no coincide con ninguna).
 */
export function filterAgenciesByLocation(
  agencies: ShalomAgencyOption[],
  location?: AgencyLocation | null,
): AgencyLocationFilter {
  const department = words(location?.department);
  const province = words(location?.province);
  const district = words(location?.district);

  const inDepartment = department
    ? agencies.filter((agency) => words(agency.departamento) === department)
    : [];
  const inProvince = province
    ? agencies.filter(
        (agency) =>
          words(agency.provincia) === province &&
          // Hay provincias con el mismo nombre en otro departamento.
          (!department || !words(agency.departamento) || words(agency.departamento) === department),
      )
    : [];

  if (district) {
    const scope = inProvince.length ? inProvince : inDepartment.length ? inDepartment : province || department ? [] : agencies;
    const needle = ` ${district} `;
    const inDistrict = scope.filter((agency) =>
      [agency.nombre_agencia, agency.api_name, agency.direccion].some((text) => ` ${words(text)} `.includes(needle)),
    );
    if (inDistrict.length) return { level: "district", agencies: inDistrict };
  }
  if (inProvince.length) return { level: "province", agencies: inProvince };
  if (inDepartment.length) return { level: "department", agencies: inDepartment };
  return { level: "none", agencies: [] };
}
