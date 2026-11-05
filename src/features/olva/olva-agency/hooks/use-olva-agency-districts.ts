import { useQuery } from "@tanstack/react-query";
import { olvaAgencyQueries } from "../queries/olva-agency.queries";

/** Idle until both a department and a province are chosen. */
export function useOlvaAgencyDistricts(
  department: string | null | undefined,
  province: string | null | undefined,
) {
  return useQuery(olvaAgencyQueries.districts(department, province));
}
