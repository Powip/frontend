import { CreateSunatProfileRequestDto, SunatProfileResponseDto } from "@/api/sunat/dto/sunat-profile.dto";
import { SunatProfile } from "@/models/sunat/sunat-profile";
import { CreateSunatProfileInput } from "@/schemas/sunat/create-sunat-profile.schema";

export function toCreateSunatProfileRequestDto(
  input: CreateSunatProfileInput
): CreateSunatProfileRequestDto {
  return {
    name: input.razonSocial,
    description: input.description,
    ruc: input.ruc,
    razonSocial: input.razonSocial,
    ubigeo: input.ubigeo,
    address: input.address,
    solUser: input.usuarioSol,
    solPassword: input.claveSol,
    certificatePassword: input.claveCertificado,
    certificate: input.certificado,
  };
}

export function toSunatProfile(
  dto: SunatProfileResponseDto
): SunatProfile {
  return {
    id: dto.id,
    companyId: dto.companyId,
    name: dto.name,
    description: dto.description,
    ruc: dto.ruc,
    razonSocial: dto.razonSocial,
    ubigeo: dto.ubigeo,
    address: dto.address,
    certificate: {
      subject: dto.certificateSubject,
      serial: dto.certificateSerial,
      validFrom: new Date(dto.certificateValidFrom),
      validUntil: new Date(dto.certificateValidUntil),
    },
    isDefault: dto.isDefault,
    isActive: dto.isActive,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function toSunatProfiles(
  dtos: SunatProfileResponseDto[]
): SunatProfile[] {
  return dtos.map(toSunatProfile);
}
