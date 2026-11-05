import { omitBlankOlvaValues } from "../../shared/utils/omit-blank-olva-values";
import type { OlvaAgencyFilters } from "../models/olva-agency-filters";

/**
 * Trims and drops blank filters, so `{ q: "" }`, `{ q: " " }` and `{}` share one cache entry.
 * Used for the query key; the API mapper applies the same rule to the request.
 */
export function normalizeOlvaAgencyFilters(filters: OlvaAgencyFilters): OlvaAgencyFilters {
  return omitBlankOlvaValues({ ...filters });
}
