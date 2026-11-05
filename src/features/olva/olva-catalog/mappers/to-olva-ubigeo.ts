import type { OlvaUbigeoResponseDto } from "../dto/list-olva-ubigeos-response.dto";
import type { OlvaUbigeo } from "../models/olva-ubigeo";

export function toOlvaUbigeo(dto: OlvaUbigeoResponseDto): OlvaUbigeo {
  return {
    code: dto.ubigeo_code,
    id: dto.ubigeo_id,
    departmentCode: dto.department_code,
    provinceCode: dto.province_code,
    districtCode: dto.district_code,
    department: dto.department,
    province: dto.province,
    district: dto.district,
  };
}
