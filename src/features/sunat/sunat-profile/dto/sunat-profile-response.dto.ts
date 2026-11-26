import type { CountryCode } from "../../shared/enums/sunat.enums";

export interface SunatProfileResponseDto {
  id: string;
  companyId: string;

  name: string;
  description: string;

  ruc: string;
  razonSocial: string;

  countryCode: CountryCode;
  ubigeo: string;
  address: string;
  establishmentCode: string;

  /** Missing in responses from an ms-sunat without the column: GENERAL. */
  taxRegime?: string;

  logoUrl: string;

  certificateSubject: string;
  certificateSerial: string;
  certificateValidFrom: string;
  certificateValidUntil: string;

  isDefault: boolean;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}
