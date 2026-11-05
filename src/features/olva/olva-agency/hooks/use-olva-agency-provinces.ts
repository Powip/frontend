import { useQuery } from "@tanstack/react-query";
import { olvaAgencyQueries } from "../queries/olva-agency.queries";

/** Idle until a department is chosen. */
export function useOlvaAgencyProvinces(department: string | null | undefined) {
  return useQuery(olvaAgencyQueries.provinces(department));
}
