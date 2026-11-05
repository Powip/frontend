import type { OlvaAgencyResponseDto } from "../dto/olva-agency-response.dto";
import type { OlvaAgency } from "../models/olva-agency";

export function toOlvaAgency(dto: OlvaAgencyResponseDto): OlvaAgency {
  const hasCoordinates = dto.latitude !== null && dto.longitude !== null;

  return {
    code: dto.code,
    name: dto.name,
    type: dto.type,
    department: dto.department,
    province: dto.province,
    district: dto.district,
    address: dto.address,
    ubigeo: dto.ubigeo,
    isPartner: dto.isPartner,
    phone: dto.phone,
    schedule: dto.schedule,
    coordinates: hasCoordinates
      ? { latitude: dto.latitude as number, longitude: dto.longitude as number }
      : null,
    headquarterCode: dto.headquarterCode,
    headquarterId: dto.headquarterId,
  };
}
