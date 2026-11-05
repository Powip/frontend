import { useQuery } from "@tanstack/react-query";
import type { OlvaPersonLookup } from "../models/olva-person-lookup";
import { olvaPersonQueries } from "../queries/olva-person.queries";

/**
 * Looks a person up by DNI/RUC. A 404 comes back as `error` (use `isOlvaNotFoundError` to tell
 * "not found" apart from a real failure).
 */
export function useOlvaPerson(lookup: OlvaPersonLookup | null) {
  return useQuery(olvaPersonQueries.lookup(lookup));
}
