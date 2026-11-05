import { omitEmptyOlvaValues } from "../../shared/utils/omit-empty-olva-values";
import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";

/** Same filters, same cache entry: blank `q` and `undefined` values are dropped. */
export function normalizeOlvaShipmentFilters(filters: OlvaShipmentFilters): OlvaShipmentFilters {
  return omitEmptyOlvaValues({ ...filters });
}
