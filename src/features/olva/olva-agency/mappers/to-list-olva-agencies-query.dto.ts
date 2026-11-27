import { omitBlankOlvaValues } from "../../shared/utils/omit-blank-olva-values";
import type { ListOlvaAgenciesQueryDto } from "../dto/olva-agency-query.dto";
import type { OlvaAgencyFilters } from "../models/olva-agency-filters";

/** Filters -> query string params, without blank values. */
export function toListOlvaAgenciesQueryDto(filters: OlvaAgencyFilters): ListOlvaAgenciesQueryDto {
  return omitBlankOlvaValues({ ...filters });
}
