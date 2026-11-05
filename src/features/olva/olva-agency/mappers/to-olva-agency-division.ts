import type { OlvaAgencyDivision } from "../models/olva-agency-division";

interface DepartmentDto {
  department: string;
  agencies: number;
}
interface ProvinceDto {
  province: string;
  agencies: number;
}
interface DistrictDto {
  district: string;
  agencies: number;
}

export function toOlvaAgencyDepartment(dto: DepartmentDto): OlvaAgencyDivision {
  return { name: dto.department, agencyCount: dto.agencies };
}

export function toOlvaAgencyProvince(dto: ProvinceDto): OlvaAgencyDivision {
  return { name: dto.province, agencyCount: dto.agencies };
}

export function toOlvaAgencyDistrict(dto: DistrictDto): OlvaAgencyDivision {
  return { name: dto.district, agencyCount: dto.agencies };
}
