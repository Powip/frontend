import type { IdentityLookupResponseDto } from "../dto/identity-lookup-response.dto";
import type { IdentityLookupResult } from "../models/identity-lookup-result.model";

export function toIdentityLookupResult(dto: IdentityLookupResponseDto): IdentityLookupResult {
  return {
    documentType: dto.documentType,
    documentNumber: dto.documentNumber,
    fullName: dto.fullName,
    tradeName: dto.tradeName,
    status: dto.status,
    condition: dto.condition,
    address: dto.address,
    ubigeo: dto.ubigeo,
    district: dto.district,
    province: dto.province,
    department: dto.department,
    fetchedAt: new Date(dto.fetchedAt),
  };
}
