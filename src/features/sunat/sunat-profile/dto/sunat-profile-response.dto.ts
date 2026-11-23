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

  logoUrl: string;

  certificateSubject: string;
  certificateSerial: string;
  certificateValidFrom: string;
  certificateValidUntil: string;

  isDefault: boolean;
  isActive: boolean;
  /** Opcional: las versiones viejas de ms-sunat no lo mandan. */
  deactivationReason?: "UNPAID" | null;

  createdAt: string;
  updatedAt: string;
}
