import type { SunatProfileResponseDto } from "../dto/sunat-profile-response.dto";
import type { SunatProfile } from "../models/sunat-profile";

export function toSunatProfile(dto: SunatProfileResponseDto): SunatProfile {
  return {
    id: dto.id,
    companyId: dto.companyId,

    name: dto.name,
    description: dto.description,

    ruc: dto.ruc,
    razonSocial: dto.razonSocial,

    countryCode: dto.countryCode,
    ubigeo: dto.ubigeo,
    address: dto.address,
    establishmentCode: dto.establishmentCode,

    logoUrl: dto.logoUrl,

    certificateSubject: dto.certificateSubject,
    certificateSerial: dto.certificateSerial,

    certificateValidFrom: dto.certificateValidFrom ? new Date(dto.certificateValidFrom) : null,

    certificateValidUntil: dto.certificateValidUntil ? new Date(dto.certificateValidUntil) : null,

    isDefault: dto.isDefault,
    isActive: dto.isActive,

    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
