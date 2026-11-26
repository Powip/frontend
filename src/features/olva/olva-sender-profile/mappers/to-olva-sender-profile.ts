import type { OlvaSenderProfileResponseDto } from "../dto/olva-sender-profile-response.dto";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";

export function toOlvaSenderProfile(dto: OlvaSenderProfileResponseDto): OlvaSenderProfile {
  return {
    id: dto.id,
    label: dto.label,
    ruc: dto.ruc,
    email: dto.email,

    firstNames: dto.firstNames,
    lastName: dto.lastName,
    phone: dto.phone,

    businessName: dto.businessName,

    isDefault: dto.isDefault,

    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
