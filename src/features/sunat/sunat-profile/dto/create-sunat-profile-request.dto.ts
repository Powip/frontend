import type { CountryCode } from "../../shared/enums/sunat.enums";

export interface CreateSunatProfileRequestDto {
  name: string;
  description?: string;

  ruc: string;
  razonSocial: string;

  countryCode: CountryCode;
  ubigeo: string;
  address: string;
  establishmentCode: string;

  solUser: string;
  solPassword: string;

  certificatePassword: string;
  certificate: File;

  logo?: File;
}
