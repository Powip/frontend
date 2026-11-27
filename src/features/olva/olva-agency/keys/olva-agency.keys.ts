import type { OlvaAgencyFilters, OlvaNearestAgenciesInput } from "../models/olva-agency-filters";

export const olvaAgencyKeys = {
  all: ["olva-agencies"] as const,

  lists: () => [...olvaAgencyKeys.all, "list"] as const,

  list: (filters: OlvaAgencyFilters) => [...olvaAgencyKeys.lists(), filters] as const,

  nearest: (input: OlvaNearestAgenciesInput) => [...olvaAgencyKeys.all, "nearest", input] as const,

  departments: () => [...olvaAgencyKeys.all, "departments"] as const,

  provinces: (department: string) => [...olvaAgencyKeys.all, "provinces", department] as const,

  districts: (department: string, province: string) =>
    [...olvaAgencyKeys.all, "districts", department, province] as const,

  details: () => [...olvaAgencyKeys.all, "detail"] as const,

  detail: (code: string) => [...olvaAgencyKeys.details(), code] as const,
};
