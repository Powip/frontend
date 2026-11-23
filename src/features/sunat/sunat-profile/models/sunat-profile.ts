import type { CountryCode } from "../../shared/enums/sunat.enums";

/** Motivo por el que el sistema desactivó un RUC (null = lo desactivó el usuario o está activo). */
export type SunatProfileDeactivationReason = "UNPAID";

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
  /** UNPAID: lo apagó el sistema porque había más RUC activos que cupos pagados. */
  deactivationReason: SunatProfileDeactivationReason | null;

  createdAt: Date;
  updatedAt: Date;
}
