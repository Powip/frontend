import {
  getNearestOlvaAgenciesApi,
  getOlvaAgenciesApi,
  getOlvaAgencyApi,
  getOlvaAgencyDepartmentsApi,
  getOlvaAgencyDistrictsApi,
  getOlvaAgencyProvincesApi,
} from "../api/olva-agency.api";
import { toListNearestOlvaAgenciesQueryDto } from "../mappers/to-list-nearest-olva-agencies-query.dto";
import { toListOlvaAgenciesQueryDto } from "../mappers/to-list-olva-agencies-query.dto";
import { toOlvaAgency } from "../mappers/to-olva-agency";
import {
  toOlvaAgencyDepartment,
  toOlvaAgencyDistrict,
  toOlvaAgencyProvince,
} from "../mappers/to-olva-agency-division";
import { toOlvaNearestAgency } from "../mappers/to-olva-nearest-agency";
import type { OlvaAgency, OlvaNearestAgency } from "../models/olva-agency";
import type { OlvaAgencyDivision } from "../models/olva-agency-division";
import type { OlvaAgencyFilters, OlvaNearestAgenciesInput } from "../models/olva-agency-filters";

export async function getOlvaAgencies(filters: OlvaAgencyFilters = {}): Promise<OlvaAgency[]> {
  const { results } = await getOlvaAgenciesApi(toListOlvaAgenciesQueryDto(filters));

  return results.map(toOlvaAgency);
}

export async function getNearestOlvaAgencies(
  input: OlvaNearestAgenciesInput,
): Promise<OlvaNearestAgency[]> {
  const { results } = await getNearestOlvaAgenciesApi(toListNearestOlvaAgenciesQueryDto(input));

  return results.map(toOlvaNearestAgency);
}

export async function getOlvaAgencyDepartments(): Promise<OlvaAgencyDivision[]> {
  const { results } = await getOlvaAgencyDepartmentsApi();

  return results.map(toOlvaAgencyDepartment);
}

export async function getOlvaAgencyProvinces(department: string): Promise<OlvaAgencyDivision[]> {
  const { results } = await getOlvaAgencyProvincesApi(department);

  return results.map(toOlvaAgencyProvince);
}

export async function getOlvaAgencyDistricts(
  department: string,
  province: string,
): Promise<OlvaAgencyDivision[]> {
  const { results } = await getOlvaAgencyDistrictsApi(department, province);

  return results.map(toOlvaAgencyDistrict);
}

export async function getOlvaAgency(code: string): Promise<OlvaAgency> {
  return toOlvaAgency(await getOlvaAgencyApi(code));
}
