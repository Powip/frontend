import { omitEmptyOlvaValues } from "../../shared/utils/omit-empty-olva-values";
import type { ListOlvaShipmentsQueryDto } from "../dto/list-olva-shipments-query.dto";
import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";

/** Filters -> query params, without blank values (a blank `q` would mean "no search" anyway). */
export function toListOlvaShipmentsQueryDto(
  filters: OlvaShipmentFilters,
): ListOlvaShipmentsQueryDto {
  return omitEmptyOlvaValues({ ...filters });
}
