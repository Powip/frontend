import { useQuery } from "@tanstack/react-query";
import { olvaAgencyQueries } from "../queries/olva-agency.queries";

export function useOlvaAgencyDepartments() {
  return useQuery(olvaAgencyQueries.departments());
}
