import { keepPreviousData, queryOptions, skipToken } from "@tanstack/react-query";
import { OLVA_REFERENCE_DATA_STALE_TIME_MS } from "../../shared/constants/olva-cache.constants";
import { shouldRetryOlvaRequest } from "../../shared/utils/should-retry-olva-request";
import { olvaAgencyKeys } from "../keys/olva-agency.keys";
import type { OlvaAgencyFilters, OlvaNearestAgenciesInput } from "../models/olva-agency-filters";
import {
  getNearestOlvaAgencies,
  getOlvaAgencies,
  getOlvaAgency,
  getOlvaAgencyDepartments,
  getOlvaAgencyDistricts,
  getOlvaAgencyProvinces,
} from "../services/olva-agency.service";
import { isValidOlvaCoordinates } from "../utils/is-valid-olva-coordinates";
import { normalizeOlvaAgencyFilters } from "../utils/normalize-olva-agency-filters";

const referenceData = {
  staleTime: OLVA_REFERENCE_DATA_STALE_TIME_MS,
  retry: shouldRetryOlvaRequest,
} as const;

// `skipToken` marks a query as "not runnable yet" (missing parent selection): it is typed, never
// fetches, and unlike `enabled: false` it needs no `!` / cast inside queryFn.
export const olvaAgencyQueries = {
  list: (filters: OlvaAgencyFilters = {}) => {
    const normalized = normalizeOlvaAgencyFilters(filters);

    return queryOptions({
      queryKey: olvaAgencyKeys.list(normalized),
      queryFn: () => getOlvaAgencies(normalized),
      // Typing in the search box keeps showing the previous results instead of flashing empty
      placeholderData: keepPreviousData,
      ...referenceData,
    });
  },

  nearest: (input: OlvaNearestAgenciesInput | null) =>
    queryOptions({
      queryKey: olvaAgencyKeys.nearest(input ?? { latitude: 0, longitude: 0 }),
      queryFn:
        input && isValidOlvaCoordinates(input.latitude, input.longitude)
          ? () => getNearestOlvaAgencies(input)
          : skipToken,
      placeholderData: keepPreviousData,
      ...referenceData,
    }),

  departments: () =>
    queryOptions({
      queryKey: olvaAgencyKeys.departments(),
      queryFn: getOlvaAgencyDepartments,
      ...referenceData,
    }),

  provinces: (department: string | null | undefined) =>
    queryOptions({
      queryKey: olvaAgencyKeys.provinces(department ?? ""),
      queryFn: department ? () => getOlvaAgencyProvinces(department) : skipToken,
      ...referenceData,
    }),

  districts: (department: string | null | undefined, province: string | null | undefined) =>
    queryOptions({
      queryKey: olvaAgencyKeys.districts(department ?? "", province ?? ""),
      queryFn:
        department && province ? () => getOlvaAgencyDistricts(department, province) : skipToken,
      ...referenceData,
    }),

  detail: (code: string | null | undefined) =>
    queryOptions({
      queryKey: olvaAgencyKeys.detail(code ?? ""),
      queryFn: code ? () => getOlvaAgency(code) : skipToken,
      ...referenceData,
    }),
};
