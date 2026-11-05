// GET /olva/agencies/departments | .../provinces | .../districts -> 200 { results }
export interface OlvaAgencyDepartmentResponseDto {
  department: string;
  agencies: number;
}

export interface OlvaAgencyProvinceResponseDto {
  province: string;
  agencies: number;
}

export interface OlvaAgencyDistrictResponseDto {
  district: string;
  agencies: number;
}

export interface ListOlvaAgencyDepartmentsResponseDto {
  results: OlvaAgencyDepartmentResponseDto[];
}

export interface ListOlvaAgencyProvincesResponseDto {
  results: OlvaAgencyProvinceResponseDto[];
}

export interface ListOlvaAgencyDistrictsResponseDto {
  results: OlvaAgencyDistrictResponseDto[];
}
