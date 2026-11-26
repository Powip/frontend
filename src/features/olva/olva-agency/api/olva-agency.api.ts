import axiosAuth from "@/lib/axiosAuth";
import { OLVA_API_BASE_URL } from "../../shared/constants/olva-api.constants";
import type { ListNearestOlvaAgenciesResponseDto } from "../dto/list-nearest-olva-agencies-response.dto";
import type { ListOlvaAgenciesResponseDto } from "../dto/list-olva-agencies-response.dto";
import type {
  ListOlvaAgencyDepartmentsResponseDto,
  ListOlvaAgencyDistrictsResponseDto,
  ListOlvaAgencyProvincesResponseDto,
} from "../dto/list-olva-agency-divisions-response.dto";
import type {
  ListNearestOlvaAgenciesQueryDto,
  ListOlvaAgenciesQueryDto,
} from "../dto/olva-agency-query.dto";
import type { OlvaAgencyResponseDto } from "../dto/olva-agency-response.dto";

const OLVA_AGENCIES_BASE = `${OLVA_API_BASE_URL}/agencies`;

// Names go in the path (accents, spaces, "Ñ"...), so they must be encoded
function departmentPath(department: string): string {
  return `${OLVA_AGENCIES_BASE}/departments/${encodeURIComponent(department)}`;
}

// GET /olva/agencies?q&department&province&district -> 200 { results }
export async function getOlvaAgenciesApi(
  params: ListOlvaAgenciesQueryDto,
): Promise<ListOlvaAgenciesResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaAgenciesResponseDto>(OLVA_AGENCIES_BASE, {
    params,
  });

  return data;
}

// GET /olva/agencies/nearest?lat&lng&limit -> 200 { results }
export async function getNearestOlvaAgenciesApi(
  params: ListNearestOlvaAgenciesQueryDto,
): Promise<ListNearestOlvaAgenciesResponseDto> {
  const { data } = await axiosAuth.get<ListNearestOlvaAgenciesResponseDto>(
    `${OLVA_AGENCIES_BASE}/nearest`,
    { params },
  );

  return data;
}

// GET /olva/agencies/departments -> 200 { results }
export async function getOlvaAgencyDepartmentsApi(): Promise<ListOlvaAgencyDepartmentsResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaAgencyDepartmentsResponseDto>(
    `${OLVA_AGENCIES_BASE}/departments`,
  );

  return data;
}

// GET /olva/agencies/departments/:department/provinces -> 200 { results }
export async function getOlvaAgencyProvincesApi(
  department: string,
): Promise<ListOlvaAgencyProvincesResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaAgencyProvincesResponseDto>(
    `${departmentPath(department)}/provinces`,
  );

  return data;
}

// GET /olva/agencies/departments/:department/provinces/:province/districts -> 200 { results }
export async function getOlvaAgencyDistrictsApi(
  department: string,
  province: string,
): Promise<ListOlvaAgencyDistrictsResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaAgencyDistrictsResponseDto>(
    `${departmentPath(department)}/provinces/${encodeURIComponent(province)}/districts`,
  );

  return data;
}

// GET /olva/agencies/:code -> 200 (404 when the code does not exist)
export async function getOlvaAgencyApi(code: string): Promise<OlvaAgencyResponseDto> {
  const { data } = await axiosAuth.get<OlvaAgencyResponseDto>(
    `${OLVA_AGENCIES_BASE}/${encodeURIComponent(code)}`,
  );

  return data;
}
