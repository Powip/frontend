import { useQuery } from "@tanstack/react-query";
import type { OlvaNearestAgenciesInput } from "../models/olva-agency-filters";
import { olvaAgencyQueries } from "../queries/olva-agency.queries";

/** Pass `null` until the user's position is known: nothing is requested meanwhile. */
export function useNearestOlvaAgencies(input: OlvaNearestAgenciesInput | null) {
  return useQuery(olvaAgencyQueries.nearest(input));
}
