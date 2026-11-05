import { useQuery } from "@tanstack/react-query";
import { olvaAgencyQueries } from "../queries/olva-agency.queries";

/** Idle until there is a code. A 404 (unknown code) is not retried. */
export function useOlvaAgency(code: string | null | undefined) {
  return useQuery(olvaAgencyQueries.detail(code));
}
