import type { CountryCode } from "../../shared/enums/sunat.enums";

export interface SunatProfile {
  id: string;
  companyId: string;

  name: string;
  description: string | null;

  ruc: string;
  razonSocial: string;

  countryCode: CountryCode;
  ubigeo: string;
  address: string;
  establishmentCode: string;

  logoUrl: string | null;

  certificateSubject: string | null;
  certificateSerial: string | null;

  certificateValidFrom: Date | null;
  certificateValidUntil: Date | null;

  isDefault: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}
