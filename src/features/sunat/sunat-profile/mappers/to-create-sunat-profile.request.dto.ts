import type { CreateSunatProfileRequestDto } from "../dto/create-sunat-profile-request.dto";
import type { CreateSunatProfileFormValues } from "../schemas/create-sunat-profile.schema";

export function toCreateSunatProfileRequestDto(
  values: CreateSunatProfileFormValues,
): CreateSunatProfileRequestDto {
  return {
    name: values.name,
    description: values.description,

    ruc: values.ruc,
    razonSocial: values.razonSocial,

    countryCode: values.countryCode,
    ubigeo: values.ubigeo,
    address: values.address,
    establishmentCode: values.establishmentCode,

    solUser: values.solUser,
    solPassword: values.solPassword,
    certificatePassword: values.certificatePassword,

    certificate: values.certificate,
    logo: values.logo,
  };
}
