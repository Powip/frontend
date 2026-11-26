import type { CountryCode } from "../../shared/enums/sunat.enums";
import type { SunatTaxRegime } from "../utils/tax-regime";

export interface CreateSunatProfileRequestDto {
  name: string;
  description?: string;

  ruc: string;
  razonSocial: string;

  countryCode: CountryCode;
  ubigeo: string;
  address: string;
  establishmentCode: string;
  taxRegime: SunatTaxRegime;

  solUser: string;
  solPassword: string;

  certificatePassword: string;
  certificate: File;

  logo?: File;
}
