import { useQuery } from "@tanstack/react-query";
import type { OlvaAgencyFilters } from "../models/olva-agency-filters";
import { olvaAgencyQueries } from "../queries/olva-agency.queries";

export function useOlvaAgencies(filters: OlvaAgencyFilters = {}) {
  return useQuery(olvaAgencyQueries.list(filters));
}
